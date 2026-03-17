import { NextRequest, NextResponse } from 'next/server';
import { requireUserAuth, type AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { getDatabaseClient } from '@/app/shared/core/database/database';

const FLASHCARDS_IMAGES_BUCKET = 'flashcards-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

type ImageSide = 'pergunta' | 'resposta';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .substring(0, 120);
}

function parseSide(raw: unknown): ImageSide | null {
  if (raw === 'pergunta' || raw === 'resposta') return raw;
  return null;
}

function isMissingImagePathColumns(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (e.code === '42703') return true;
  const msg = e.message ?? '';
  return (
    msg.includes('pergunta_imagem_path') || msg.includes('resposta_imagem_path')
  );
}

async function ensureProfessorOrAdmin(request: AuthenticatedRequest) {
  const client = getDatabaseClient();
  const { data: vinculo, error } = await client
    .from('usuarios_empresas')
    .select('id, empresa_id, papel_base, is_admin')
    .eq('usuario_id', request.user!.id)
    .eq('ativo', true)
    .is('deleted_at', null)
    .limit(20);

  if (error || !Array.isArray(vinculo) || vinculo.length === 0) {
    throw new Error('Apenas professores ou admins podem realizar esta ação.');
  }

  const allowed = vinculo.find((row) => {
    const papel = (row as { papel_base?: string | null }).papel_base;
    const isAdmin = (row as { is_admin?: boolean | null }).is_admin === true;
    return papel === 'professor' || papel === 'usuario' || isAdmin;
  });
  if (!allowed) {
    throw new Error('Apenas professores ou admins podem realizar esta ação.');
  }

  return {
    empresaId: (allowed as { empresa_id?: string | null }).empresa_id ?? null,
  };
}

async function postHandler(request: AuthenticatedRequest, params: { id: string }) {
  try {
    const { empresaId: userEmpresaId } = await ensureProfessorOrAdmin(request);

    const formData = await request.formData();
    const side = parseSide(formData.get('side'));
    const file = formData.get('file') as File | null;

    if (!side) {
      return NextResponse.json({ error: 'Campo "side" inválido. Use "pergunta" ou "resposta".' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado (campo "file").' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use JPEG, PNG, WEBP ou GIF.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Tamanho máximo: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB` },
        { status: 400 },
      );
    }

    const client = getDatabaseClient();

    const { data: flashcard, error: fcError } = await client
      .from('flashcards')
      .select('id, empresa_id, pergunta_imagem_path, resposta_imagem_path')
      .eq('id', params.id)
      .maybeSingle();

    if (fcError && isMissingImagePathColumns(fcError)) {
      return NextResponse.json(
        {
          error:
            'Seu banco ainda não possui as colunas de imagem em `flashcards` (pergunta_imagem_path/resposta_imagem_path). Aplique a migration `20260119100000_add_flashcards_image_paths.sql` e tente novamente.',
        },
        { status: 400 },
      );
    }

    if (fcError || !flashcard) {
      return NextResponse.json({ error: 'Flashcard não encontrado.' }, { status: 404 });
    }

    const flashcardEmpresaId = (flashcard as { empresa_id?: string | null }).empresa_id ?? null;
    if (!flashcardEmpresaId) {
      return NextResponse.json({ error: 'Flashcard sem empresa_id (dados inconsistentes).' }, { status: 400 });
    }

    if (userEmpresaId && flashcardEmpresaId !== userEmpresaId) {
      return NextResponse.json({ error: 'Você não tem permissão para alterar este flashcard.' }, { status: 403 });
    }

    const oldPath =
      side === 'pergunta'
        ? ((flashcard as { pergunta_imagem_path?: string | null }).pergunta_imagem_path ?? null)
        : ((flashcard as { resposta_imagem_path?: string | null }).resposta_imagem_path ?? null);

    const timestamp = Date.now();
    const safeName = sanitizeFileName(file.name);
    const newPath = `${flashcardEmpresaId}/${params.id}/${side}/${timestamp}-${safeName}`;

    // Upload
    const { error: uploadError } = await client.storage
      .from(FLASHCARDS_IMAGES_BUCKET)
      .upload(newPath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `Erro ao fazer upload: ${uploadError.message}` }, { status: 400 });
    }

    // Update DB
    const updatePayload =
      side === 'pergunta'
        ? { pergunta_imagem_path: newPath }
        : { resposta_imagem_path: newPath };

    const { error: updateError } = await client.from('flashcards').update(updatePayload).eq('id', params.id);

    if (updateError) {
      // Cleanup uploaded file if DB update fails
      await client.storage.from(FLASHCARDS_IMAGES_BUCKET).remove([newPath]);
      if (isMissingImagePathColumns(updateError)) {
        return NextResponse.json(
          {
            error:
              'Não foi possível salvar a imagem porque seu banco ainda não possui as colunas `pergunta_imagem_path/resposta_imagem_path` em `flashcards`. Aplique a migration `20260119100000_add_flashcards_image_paths.sql`.',
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: `Erro ao salvar imagem no flashcard: ${updateError.message}` }, { status: 400 });
    }

    // Cleanup old file (best-effort)
    if (oldPath) {
      await client.storage.from(FLASHCARDS_IMAGES_BUCKET).remove([oldPath]);
    }

    return NextResponse.json({ data: { side, path: newPath } }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function deleteHandler(request: AuthenticatedRequest, params: { id: string }) {
  try {
    const { empresaId: userEmpresaId } = await ensureProfessorOrAdmin(request);

    const { searchParams } = new URL(request.url);
    const side = parseSide(searchParams.get('side'));
    if (!side) {
      return NextResponse.json({ error: 'Parâmetro "side" inválido. Use "pergunta" ou "resposta".' }, { status: 400 });
    }

    const client = getDatabaseClient();
    const { data: flashcard, error: fcError } = await client
      .from('flashcards')
      .select('id, empresa_id, pergunta_imagem_path, resposta_imagem_path')
      .eq('id', params.id)
      .maybeSingle();

    if (fcError && isMissingImagePathColumns(fcError)) {
      return NextResponse.json(
        {
          error:
            'Seu banco ainda não possui as colunas de imagem em `flashcards` (pergunta_imagem_path/resposta_imagem_path). Aplique a migration `20260119100000_add_flashcards_image_paths.sql` e tente novamente.',
        },
        { status: 400 },
      );
    }

    if (fcError || !flashcard) {
      return NextResponse.json({ error: 'Flashcard não encontrado.' }, { status: 404 });
    }

    const flashcardEmpresaId = (flashcard as { empresa_id?: string | null }).empresa_id ?? null;
    if (!flashcardEmpresaId) {
      return NextResponse.json({ error: 'Flashcard sem empresa_id (dados inconsistentes).' }, { status: 400 });
    }

    if (userEmpresaId && flashcardEmpresaId !== userEmpresaId) {
      return NextResponse.json({ error: 'Você não tem permissão para alterar este flashcard.' }, { status: 403 });
    }

    const currentPath =
      side === 'pergunta'
        ? ((flashcard as { pergunta_imagem_path?: string | null }).pergunta_imagem_path ?? null)
        : ((flashcard as { resposta_imagem_path?: string | null }).resposta_imagem_path ?? null);

    const updatePayload =
      side === 'pergunta'
        ? { pergunta_imagem_path: null }
        : { resposta_imagem_path: null };

    const { error: updateError } = await client.from('flashcards').update(updatePayload).eq('id', params.id);
    if (updateError) {
      if (isMissingImagePathColumns(updateError)) {
        return NextResponse.json(
          {
            error:
              'Não foi possível remover a imagem porque seu banco ainda não possui as colunas `pergunta_imagem_path/resposta_imagem_path` em `flashcards`. Aplique a migration `20260119100000_add_flashcards_image_paths.sql`.',
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: `Erro ao remover imagem do flashcard: ${updateError.message}` }, { status: 400 });
    }

    if (currentPath) {
      await client.storage.from(FLASHCARDS_IMAGES_BUCKET).remove([currentPath]);
    }

    return NextResponse.json({ data: { side, removed: true } }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => postHandler(req, params))(request);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => deleteHandler(req, params))(request);
}

