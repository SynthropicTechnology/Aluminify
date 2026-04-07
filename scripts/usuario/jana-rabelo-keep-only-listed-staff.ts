/**
 * Jana Rabelo: mantém como staff (professor/admin) apenas os e-mails listados.
 * Os demais que hoje são staff na Jana Rabelo passam a ter apenas vínculo como aluno
 * (apenas usuarios_empresas é alterada; NÃO altera public.usuarios).
 *
 * Uso: npx tsx scripts/usuario/jana-rabelo-keep-only-listed-staff.ts
 *      npx tsx scripts/usuario/jana-rabelo-keep-only-listed-staff.ts --dry-run  (só simula)
 *
 * Requisitos: .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const EMAILS_MANTER_COMO_STAFF = [
  "alinecompositora1707@gmail.com",
  "anaaugusta.lages.z@gmail.com",
  "carolinaos7@icloud.com",
  "moura.anacarolina1@gmail.com",
  "correcoes.anaclaramolina@gmail.com",
  "analaura.ribeiro1692@icloud.com",
  "brcarvalho.bcg@gmail.com",
  "bsucro@gmail.com",
  "dulcigoes8@yahoo.com.br",
  "eduardaarriel.oliveira8@gmail.com",
  "felipe.vilanova148@gmail.com",
  "atefla@yahoo.com.br",
  "gabriel.amorim7575@gmail.com",
  "giovanaamaral97@gmail.com",
  "iaradias.prof@gmail.com",
  "islainemeirelles@letras.ufrj.br",
  "janainarabelocfa@gmail.com",
  "lcmagalhaesavelar@gmail.com",
  "lsamueloliveira@yahoo.com",
  "lucypangnotta@gmail.com",
  "coordpedagogicajana@gmail.com",
  "marianaraabe@gmail.com",
  "mariannelira@yahoo.com.br",
  "nathaliagrecocor@gmail.com",
  "adm-financeiro@janarabelo.com.br",
  "contato@janarabelo.com.br",
  "vitoria.reginalisboa@gmail.com",
  "diniz.yasmine@gmail.com",
].map((e) => e.trim().toLowerCase());

const EMPRESA_NOME = "Jana Rabelo";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) em .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("--- Jana Rabelo: manter apenas lista como staff ---\n");
  if (dryRun) console.log("(modo --dry-run: nenhuma alteração será feita)\n");

  // 1) Resolver empresa "Jana Rabelo"
  const { data: empresa, error: errEmpresa } = await supabase
    .from("empresas")
    .select("id, nome")
    .ilike("nome", EMPRESA_NOME)
    .maybeSingle();

  if (errEmpresa || !empresa?.id) {
    console.error("Empresa não encontrada:", EMPRESA_NOME, errEmpresa?.message ?? "");
    process.exit(1);
  }
  const empresaId = empresa.id;
  console.log("Empresa:", empresa.nome, "(" + empresaId + ")\n");

  // 2) Buscar staff atual da empresa via usuarios_empresas (escopo correto por tenant)
  const { data: staffRows, error: errStaffRows } = await supabase
    .from("usuarios_empresas")
    .select("usuario_id, papel_base, usuarios!inner(id, email)")
    .eq("empresa_id", empresaId)
    .in("papel_base", ["professor", "usuario"])
    .eq("ativo", true)
    .is("deleted_at", null);

  if (errStaffRows) {
    console.error("Erro ao buscar staff via usuarios_empresas:", errStaffRows.message);
    process.exit(1);
  }

  const emailToId = new Map<string, string>();
  const usuariosTodos = (staffRows ?? []).map((row) => {
    const usuario = Array.isArray(row.usuarios)
      ? row.usuarios[0]
      : row.usuarios;
    return {
      id: row.usuario_id,
      email: (usuario as { email?: string } | null)?.email ?? null,
      papelBase: row.papel_base,
    };
  });

  usuariosTodos.forEach((u) => {
    if (u.email) emailToId.set(String(u.email).trim().toLowerCase(), u.id);
  });

  const keepIds = new Set<string>();
  const emailsNaoEncontrados: string[] = [];
  EMAILS_MANTER_COMO_STAFF.forEach((email) => {
    const id = emailToId.get(email);
    if (id) keepIds.add(id);
    else emailsNaoEncontrados.push(email);
  });

  if (emailsNaoEncontrados.length > 0) {
    console.log("Aviso: estes e-mails da lista não constam como staff ativo na Jana Rabelo (serão ignorados para 'manter'):");
    emailsNaoEncontrados.forEach((e) => console.log("  -", e));
    console.log("");
  }

  console.log("Manter como staff:", keepIds.size, "usuários\n");

  // 3) Staff atual da Jana Rabelo que vamos REMOVER (deixar só aluno)
  const toRemove = (usuariosTodos ?? []).filter((u) => !keepIds.has(u.id));
  console.log("Remover vínculo de staff (ficar apenas aluno):", toRemove.length, "usuários\n");

  if (toRemove.length === 0) {
    console.log("Nada a alterar.");
    process.exit(0);
  }

  if (dryRun) {
    console.log("(dry-run) Seriam desativados vínculos de staff em usuarios_empresas:", toRemove.length);
    toRemove.slice(0, 10).forEach((u) => console.log("  -", u.email ?? u.id));
    if (toRemove.length > 10) console.log("  ... e mais", toRemove.length - 10);
    process.exit(0);
  }

  const idsToRemove = toRemove.map((u) => u.id);

  // 4) Garantir vínculo como aluno antes de remover staff
  const alunoRows = idsToRemove.map((usuarioId) => ({
    usuario_id: usuarioId,
    empresa_id: empresaId,
    papel_base: "aluno",
    ativo: true,
    is_admin: false,
    is_owner: false,
    deleted_at: null,
  }));

  const { error: errEnsureAluno } = await supabase
    .from("usuarios_empresas")
    .upsert(alunoRows, {
      onConflict: "usuario_id,empresa_id,papel_base",
      ignoreDuplicates: true,
    });

  if (errEnsureAluno) {
    console.error("Erro ao garantir vínculo de aluno em usuarios_empresas:", errEnsureAluno.message);
    process.exit(1);
  }

  // 5) Desativar apenas vínculos de staff na empresa (sem tocar em public.usuarios)
  const { error: errUpdate } = await supabase
    .from("usuarios_empresas")
    .update({
      ativo: false,
      deleted_at: new Date().toISOString(),
      is_admin: false,
      is_owner: false,
    })
    .eq("empresa_id", empresaId)
    .in("usuario_id", idsToRemove)
    .in("papel_base", ["professor", "usuario"])
    .is("deleted_at", null)
    .eq("ativo", true);

  if (errUpdate) {
    console.error("Erro ao desativar vínculos de staff:", errUpdate.message);
    process.exit(1);
  }
  console.log("OK: vínculos de staff desativados em usuarios_empresas:", idsToRemove.length);

  // 6) Remover de empresa_admins (se existir vínculo)
  const { data: deletedAdmins, error: errAdmins } = await supabase
    .from("empresa_admins")
    .delete()
    .eq("empresa_id", empresaId)
    .in("user_id", idsToRemove)
    .select("user_id");

  if (!errAdmins) {
    const n = Array.isArray(deletedAdmins) ? deletedAdmins.length : 0;
    if (n > 0) console.log("OK: removidos de empresa_admins:", n);
  } else {
    console.warn("Aviso ao remover empresa_admins:", errAdmins.message);
  }

  console.log("\nConcluído. Os", toRemove.length, "usuários agora têm apenas cadastro ativo como aluno na Jana Rabelo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
