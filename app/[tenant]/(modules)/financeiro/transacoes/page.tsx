import type { Metadata } from 'next'
import { Suspense } from "react";
import { createClient } from "@/app/shared/core/server";
import { requireUser } from "@/app/shared/core/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TransactionFilters } from "@/app/[tenant]/(modules)/financeiro/components/transaction-filters";
import { Skeleton } from "@/app/shared/components/feedback/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { createFinancialService } from "@/app/[tenant]/(modules)/financeiro/services";
import type { TransactionStatus, Provider } from "@/app/shared/types/entities/financial";
import { ArrowLeft } from "lucide-react";
import { TransactionsTable, type TransactionRow } from "./components/transactions-table";

export const metadata: Metadata = {
  title: 'Transações'
}

interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface SearchParams {
  page?: string;
  status?: TransactionStatus;
  provider?: Provider;
  buyerEmail?: string;
}

export default async function TransacoesPage({
  searchParams,
  params,
}: {
  searchParams: Promise<SearchParams>;
  params: Promise<{ tenant: string }>;
}) {
  const user = await requireUser({ allowedRoles: ["usuario"] });
  const { tenant } = await params;

  const searchParamsData = await searchParams;
  const supabase = await createClient();
  const financialService = createFinancialService(supabase);

  let transactions: TransactionRow[] = [];
  let meta: PaginationMeta = { page: 1, perPage: 20, total: 0, totalPages: 0 };

  try {
    if (user.empresaId) {
      const result = await financialService.listTransactions({
        empresaId: user.empresaId,
        page: searchParamsData.page ? parseInt(searchParamsData.page, 10) : 1,
        pageSize: 20,
        sortBy: "sale_date",
        sortOrder: "desc",
        status: searchParamsData.status,
        provider: searchParamsData.provider,
        buyerEmail: searchParamsData.buyerEmail,
      });

      transactions = result.data.map((t) => ({
        id: t.id,
        buyerEmail: t.buyerEmail,
        buyerName: t.buyerName,
        amountCents: t.amountCents,
        currency: t.currency,
        status: t.status,
        provider: t.provider,
        saleDate: t.saleDate.toISOString(),
        paymentMethod: t.paymentMethod,
      }));

      meta = {
        page: result.meta.page,
        perPage: result.meta.perPage,
        total: result.meta.total,
        totalPages: result.meta.totalPages,
      };
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
  }

  const currentPage = meta.page;
  const totalPages = meta.totalPages;

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-8 px-4 pb-10 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-4 h-full min-h-150">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${tenant}/financeiro`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="page-title">Transações</h1>
            <p className="page-subtitle">
              {meta.total} transações encontradas
            </p>
          </div>
        </div>
      </header>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex gap-4"><Skeleton className="h-10 w-50" /><Skeleton className="h-10 w-45" /><Skeleton className="h-10 w-45" /></div>}>
            <TransactionFilters
              currentStatus={searchParamsData.status}
              currentProvider={searchParamsData.provider}
              currentSearch={searchParamsData.buyerEmail}
            />
          </Suspense>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <TransactionsTable transactions={transactions} tenant={tenant} />
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            {currentPage > 1 && (
              <PaginationItem>
                <PaginationPrevious
                  href={`?${new URLSearchParams({
                    ...searchParamsData,
                    page: String(currentPage - 1),
                  }).toString()}`}
                />
              </PaginationItem>
            )}

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    href={`?${new URLSearchParams({
                      ...searchParamsData,
                      page: String(pageNum),
                    }).toString()}`}
                    isActive={pageNum === currentPage}
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            {currentPage < totalPages && (
              <PaginationItem>
                <PaginationNext
                  href={`?${new URLSearchParams({
                    ...searchParamsData,
                    page: String(currentPage + 1),
                  }).toString()}`}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
      </section>
    </div>
  );
}
