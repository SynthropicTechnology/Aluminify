"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Copy,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/app/shared/components/forms/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/shared/components/forms/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/shared/components/dataviz/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/shared/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/shared/components/overlay/dialog";
import { Label } from "@/app/shared/components/forms/label";
import { Textarea } from "@/app/shared/components/forms/textarea";
import { Switch } from "@/app/shared/components/forms/switch";
import { useToast } from "@/hooks/use-toast";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxUses: number | null;
  currentUses: number;
  validFrom: string;
  validUntil: string | null;
  active: boolean;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export default function CouponsPage() {
  const _router = useRouter();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    maxUses: "",
    validFrom: "",
    validUntil: "",
    active: true,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      if (active !== "all") {
        params.set("active", active);
      }

      const response = await fetch(`/api/financeiro/coupons?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch coupons");
      }

      const result = await response.json();
      setCoupons(result.data || []);
      setMeta(result.meta || null);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os cupons",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, active, toast]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleDelete = async () => {
    if (!couponToDelete) return;

    setDeleting(couponToDelete.id);
    try {
      const response = await fetch(`/api/financeiro/coupons/${couponToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete coupon");
      }

      toast({
        title: "Sucesso",
        description: "Cupom excluído com sucesso",
      });

      fetchCoupons();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cupom",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
      setDeleteDialogOpen(false);
      setCouponToDelete(null);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error("Error copying code:", error);
    }
  };

  const openCreateDialog = () => {
    setEditingCoupon(null);
    setFormData({
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: "",
      maxUses: "",
      validFrom: new Date().toISOString().split("T")[0],
      validUntil: "",
      active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || "",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      maxUses: coupon.maxUses?.toString() || "",
      validFrom: new Date(coupon.validFrom).toISOString().split("T")[0],
      validUntil: coupon.validUntil
        ? new Date(coupon.validUntil).toISOString().split("T")[0]
        : "",
      active: coupon.active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast({
        title: "Erro",
        description: "O código do cupom é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const discountValue = parseFloat(formData.discountValue.replace(",", "."));
    if (isNaN(discountValue) || discountValue <= 0) {
      toast({
        title: "Erro",
        description: "O valor do desconto deve ser válido",
        variant: "destructive",
      });
      return;
    }

    if (formData.discountType === "percentage" && discountValue > 100) {
      toast({
        title: "Erro",
        description: "O desconto percentual não pode ser maior que 100%",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || null,
        discountType: formData.discountType,
        discountValue,
        maxUses: formData.maxUses ? parseInt(formData.maxUses, 10) : null,
        validFrom: new Date(formData.validFrom),
        validUntil: formData.validUntil ? new Date(formData.validUntil) : null,
        active: formData.active,
      };

      const url = editingCoupon
        ? `/api/financeiro/coupons/${editingCoupon.id}`
        : "/api/financeiro/coupons";

      const response = await fetch(url, {
        method: editingCoupon ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save coupon");
      }

      toast({
        title: "Sucesso",
        description: editingCoupon
          ? "Cupom atualizado com sucesso"
          : "Cupom criado com sucesso",
      });

      setDialogOpen(false);
      fetchCoupons();
    } catch (error) {
      console.error("Error saving coupon:", error);
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Não foi possível salvar o cupom",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDiscount = (type: string, value: number) => {
    if (type === "percentage") {
      return `${value}%`;
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const getCouponStatus = (coupon: Coupon) => {
    if (!coupon.active) {
      return { label: "Inativo", variant: "secondary" as const };
    }

    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null;

    if (validFrom > now) {
      return { label: "Agendado", variant: "outline" as const };
    }

    if (validUntil && validUntil < now) {
      return { label: "Expirado", variant: "destructive" as const };
    }

    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
      return { label: "Esgotado", variant: "destructive" as const };
    }

    return { label: "Ativo", variant: "default" as const };
  };

  const filteredCoupons = coupons.filter((coupon) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      coupon.code.toLowerCase().includes(searchLower) ||
      coupon.description?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-8 px-4 pb-10 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-4 h-full min-h-150">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="page-title">Cupons de Desconto</h1>
          <p className="page-subtitle">
            Gerencie os cupons de desconto disponíveis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cupom
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={active} onValueChange={setActive}>
          <SelectTrigger className="w-37.5">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativo</SelectItem>
            <SelectItem value="false">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Uso</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Carregando...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredCoupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Ticket className="h-8 w-8" />
                    <p>Nenhum cupom encontrado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCoupons.map((coupon) => {
                const status = getCouponStatus(coupon);
                return (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {coupon.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyCode(coupon.code)}
                        >
                          {copiedCode === coupon.code ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      {coupon.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {coupon.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {formatDiscount(coupon.discountType, coupon.discountValue)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {coupon.currentUses}
                        {coupon.maxUses !== null && ` / ${coupon.maxUses}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>De: {formatDate(coupon.validFrom)}</p>
                        {coupon.validUntil && (
                          <p className="text-muted-foreground">
                            Até: {formatDate(coupon.validUntil)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(coupon)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCouponToDelete(coupon);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleting === coupon.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(page - 1) * pageSize + 1} a{" "}
            {Math.min(page * pageSize, meta.total)} de {meta.total} cupons
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Página {page} de {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? "Editar Cupom" : "Novo Cupom"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="Ex: DESCONTO10"
                className="uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Descrição do cupom..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountType">Tipo</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value: "percentage" | "fixed") =>
                    setFormData((prev) => ({ ...prev, discountType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountValue">Valor *</Label>
                <Input
                  id="discountValue"
                  value={formData.discountValue}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, discountValue: e.target.value }))
                  }
                  placeholder={formData.discountType === "percentage" ? "10" : "50,00"}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">Limite de Usos</Label>
              <Input
                id="maxUses"
                type="number"
                value={formData.maxUses}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, maxUses: e.target.value }))
                }
                placeholder="Ilimitado"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Válido de *</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, validFrom: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntil">Válido até</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, validUntil: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Cupom pode ser utilizado
                </p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, active: checked }))
                }
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingCoupon ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      </section>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cupom &quot;{couponToDelete?.code}&quot;?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
