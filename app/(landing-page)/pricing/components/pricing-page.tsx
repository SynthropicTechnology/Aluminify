"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "../../components/nav";
import { Footer } from "../../components/footer";
import { Check, HelpCircle } from "lucide-react";
import type { PublicPlan } from "@/shared/types/entities/subscription";

function formatCurrency(cents: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(cents / 100);
}

function PlanCardSkeleton() {
    return (
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col animate-pulse">
            <div className="mb-4">
                <div className="h-6 w-24 bg-muted rounded" />
                <div className="h-4 w-40 bg-muted rounded mt-2" />
            </div>
            <div className="mb-6">
                <div className="h-10 w-32 bg-muted rounded" />
            </div>
            <div className="space-y-3 mb-8 grow">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-4 bg-muted rounded w-3/4" />
                ))}
            </div>
            <div className="h-12 bg-muted rounded-lg" />
        </div>
    );
}

function PlanCard({
    plan,
    isYearly,
    isFeatured,
}: {
    plan: PublicPlan;
    isYearly: boolean;
    isFeatured: boolean;
}) {
    const isFree = plan.price_monthly_cents === 0;
    const isEnterprise = plan.slug === "personalizado";
    const price = isYearly && plan.price_yearly_cents
        ? plan.price_yearly_cents
        : plan.price_monthly_cents;
    const monthlyEquivalent = isYearly && plan.price_yearly_cents
        ? Math.round(plan.price_yearly_cents / 12)
        : plan.price_monthly_cents;

    const features = Array.isArray(plan.features) ? plan.features : [];

    async function handleSubscribe() {
        if (isFree || isEnterprise) return;

        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plan_id: plan.id,
                    billing_interval: isYearly ? "year" : "month",
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch {
            // User may not be authenticated - redirect to signup
            window.location.href = "/auth/signup";
        }
    }

    if (isFeatured) {
        return (
            <div className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black rounded-2xl p-8 flex flex-col shadow-2xl relative overflow-hidden transform md:-translate-y-4">
                {plan.badge_text && (
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase">
                        {plan.badge_text}
                    </div>
                )}
                <div className="mb-4">
                    <h3 className="text-xl font-bold font-display">{plan.name}</h3>
                    <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">
                        {plan.description || "A gente cuida de tudo pra você."}
                    </p>
                </div>
                <div className="mb-6">
                    <span className="text-4xl font-bold">
                        {formatCurrency(monthlyEquivalent)}
                    </span>
                    <span className="text-sm text-zinc-400 dark:text-zinc-600">/mês</span>
                    {isYearly && plan.price_yearly_cents && (
                        <div className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
                            {formatCurrency(price)} cobrado anualmente
                        </div>
                    )}
                </div>
                <div className="text-sm space-y-4 mb-8 grow text-zinc-300 dark:text-zinc-700">
                    {features.map((feature, i) => (
                        <div key={i} className="flex gap-3">
                            <Check className="w-5 h-5 text-blue-400 shrink-0" />
                            <span className={i === 0 ? "font-bold text-white dark:text-black" : ""}>
                                {feature}
                            </span>
                        </div>
                    ))}
                    {plan.extra_student_price_cents && (
                        <div className="p-3 bg-white/10 dark:bg-black/10 rounded-lg text-xs mt-4">
                            + {formatCurrency(plan.extra_student_price_cents)} por aluno extra ativo no mês.
                        </div>
                    )}
                </div>
                <button
                    onClick={handleSubscribe}
                    className="w-full py-3 bg-white dark:bg-black text-black dark:text-white rounded-lg text-center font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                >
                    Testar grátis por 14 dias
                </button>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col hover:border-zinc-400 transition-colors">
            {plan.badge_text && (
                <div className="text-xs font-bold text-primary mb-2 uppercase">
                    {plan.badge_text}
                </div>
            )}
            <div className="mb-4">
                <h3 className="text-xl font-bold font-display">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                </p>
            </div>
            <div className="mb-6">
                {isEnterprise ? (
                    <span className="text-4xl font-bold">Sob consulta</span>
                ) : (
                    <>
                        <span className="text-4xl font-bold">
                            {isFree ? "R$ 0" : formatCurrency(monthlyEquivalent)}
                        </span>
                        {!isFree && (
                            <span className="text-sm text-muted-foreground">/mês</span>
                        )}
                        {isYearly && plan.price_yearly_cents && !isFree && (
                            <div className="text-xs text-muted-foreground mt-1">
                                {formatCurrency(price)} cobrado anualmente
                            </div>
                        )}
                    </>
                )}
            </div>
            <div className="text-sm space-y-4 mb-8 grow">
                {features.map((feature, i) => (
                    <div key={i} className="flex gap-3">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <span>{feature}</span>
                    </div>
                ))}
            </div>
            {isFree ? (
                <Link
                    href="/opensource"
                    className="w-full py-3 border border-border rounded-lg text-center font-medium hover:bg-muted transition-colors"
                >
                    Saiba mais
                </Link>
            ) : isEnterprise ? (
                <Link
                    href="mailto:contato@aluminify.com"
                    className="w-full py-3 border border-border rounded-lg text-center font-medium hover:bg-muted transition-colors"
                >
                    Falar com a gente
                </Link>
            ) : (
                <button
                    onClick={handleSubscribe}
                    className="w-full py-3 border border-border rounded-lg text-center font-medium hover:bg-muted transition-colors"
                >
                    Assinar
                </button>
            )}
        </div>
    );
}

export function PricingPage() {
    const [plans, setPlans] = useState<PublicPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isYearly, setIsYearly] = useState(false);

    useEffect(() => {
        fetch("/api/plans")
            .then((res) => res.json())
            .then((data) => {
                setPlans(data.plans || []);
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, []);

    return (
        <div className="bg-background text-foreground font-sans antialiased transition-colors duration-200">
            <Nav activeLink="precos" />

            <main>
                <section className="pt-24 pb-20 text-center px-4">
                    <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-6 text-foreground">
                        Preço justo e transparente.
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
                        Escolha o plano ideal para o tamanho do seu curso.
                        Comece pequeno e cresça sem surpresas.
                    </p>

                    <div className="inline-flex items-center bg-muted p-1 rounded-lg">
                        <button
                            onClick={() => setIsYearly(false)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                !isYearly
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setIsYearly(true)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                isYearly
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Anual (-20%)
                        </button>
                    </div>
                </section>

                <section className="pb-24 px-4">
                    <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
                        {loading ? (
                            <>
                                <PlanCardSkeleton />
                                <PlanCardSkeleton />
                                <PlanCardSkeleton />
                            </>
                        ) : error ? (
                            <div className="col-span-3 text-center py-12">
                                <p className="text-muted-foreground mb-4">
                                    Não foi possível carregar os planos.
                                </p>
                                <button
                                    onClick={() => {
                                        setError(false);
                                        setLoading(true);
                                        fetch("/api/plans")
                                            .then((res) => res.json())
                                            .then((data) => {
                                                setPlans(data.plans || []);
                                                setLoading(false);
                                            })
                                            .catch(() => {
                                                setError(true);
                                                setLoading(false);
                                            });
                                    }}
                                    className="text-primary hover:underline"
                                >
                                    Tentar novamente
                                </button>
                            </div>
                        ) : plans.length === 0 ? (
                            <div className="col-span-3 text-center py-12">
                                <p className="text-muted-foreground">
                                    Planos em breve.
                                </p>
                            </div>
                        ) : (
                            plans.map((plan) => (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    isYearly={isYearly}
                                    isFeatured={plan.is_featured}
                                />
                            ))
                        )}
                    </div>
                </section>

                <section className="py-24 bg-card border-t border-border">
                    <div className="max-w-3xl mx-auto px-4">
                        <h2 className="landing-section-title text-center mb-12">Perguntas Frequentes</h2>
                        <div className="space-y-4">
                            <details className="group border border-border rounded-lg p-4 cursor-pointer bg-background">
                                <summary className="flex justify-between items-center font-medium list-none text-foreground">
                                    <span>O que conta como &quot;aluno ativo&quot;?</span>
                                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                </summary>
                                <div className="text-muted-foreground text-sm mt-3 pt-3 border-t border-border leading-relaxed">
                                    Consideramos ativo qualquer aluno que tenha feito login na plataforma pelo menos uma vez no período de cobrança (mês). Alunos cadastrados que não acessam não geram custo variável.
                                </div>
                            </details>
                            <details className="group border border-border rounded-lg p-4 cursor-pointer bg-background">
                                <summary className="flex justify-between items-center font-medium list-none text-foreground">
                                    <span>Posso migrar do plano Gratuito para o Nuvem?</span>
                                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                </summary>
                                <div className="text-muted-foreground text-sm mt-3 pt-3 border-t border-border leading-relaxed">
                                    Sim! Ajudamos você a trazer todos os seus dados (alunos, cursos, progresso) para a nossa nuvem sem perder nada.
                                </div>
                            </details>
                            <details className="group border border-border rounded-lg p-4 cursor-pointer bg-background">
                                <summary className="flex justify-between items-center font-medium list-none text-foreground">
                                    <span>Existe taxa de instalação?</span>
                                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                </summary>
                                <div className="text-muted-foreground text-sm mt-3 pt-3 border-t border-border leading-relaxed">
                                    Não para o plano Nuvem. Você cria a conta e começa a usar na hora. No plano Personalizado, pode haver custos se precisar de ajustes específicos.
                                </div>
                            </details>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
