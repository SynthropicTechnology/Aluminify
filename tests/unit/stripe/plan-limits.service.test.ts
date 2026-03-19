/**
 * Unit tests for plan-limits.service.ts
 */

const mockFrom = jest.fn();

jest.mock("@/app/shared/core/database/database", () => ({
  getDatabaseClient: () => ({
    from: mockFrom,
  }),
}));

import {
  getPlanLimits,
  checkStudentLimit,
  checkCourseLimit,
  checkModuleAccess,
  isWithinGracePeriod,
} from "@/app/shared/core/services/plan-limits.service";

/**
 * Creates a chainable mock that mimics Supabase's query builder.
 * The chain is thenable: awaiting the last method call resolves to `result`.
 */
function createChain(result: { data?: unknown; count?: number; error?: unknown }) {
  const resolvedResult = { data: null, count: null, error: null, ...result };
  const chain: Record<string, jest.Mock> = {};
  // Every method returns the chain itself, which is also a thenable
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.is = jest.fn().mockReturnValue(chain);
  chain.or = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(resolvedResult);
  chain.maybeSingle = jest.fn().mockResolvedValue(resolvedResult);
  // Make the chain itself thenable (for queries without .single())
  chain.then = jest.fn().mockImplementation((resolve: (v: unknown) => void) => {
    return Promise.resolve(resolvedResult).then(resolve);
  });
  return chain;
}

describe("plan-limits.service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("getPlanLimits", () => {
    it("should return gratuito plan from DB when empresa has no subscription", async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: null } }))
        .mockReturnValueOnce(
          createChain({
            data: {
              max_active_students: null,
              max_courses: null,
              max_storage_mb: null,
              allowed_modules: null,
            },
          })
        );

      const result = await getPlanLimits("empresa-1");

      expect(result).toEqual({
        max_active_students: null,
        max_courses: null,
        max_storage_mb: null,
        allowed_modules: [],
      });
    });

    it("should use unlimited limits when gratuito plan row is missing", async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: null } }))
        .mockReturnValueOnce(createChain({ data: null }));

      const result = await getPlanLimits("empresa-1");

      expect(result).toEqual({
        max_active_students: null,
        max_courses: null,
        max_storage_mb: null,
        allowed_modules: [],
      });
    });

    it("should return plan limits from subscription", async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: "sub-1" } }))
        .mockReturnValueOnce(createChain({
          data: {
            status: "active",
            plan_id: "plan-1",
            subscription_plans: {
              max_active_students: 500,
              max_courses: 20,
              max_storage_mb: 5120,
              allowed_modules: ["flashcards", "cronograma"],
            },
          },
        }));

      const result = await getPlanLimits("empresa-1");

      expect(result).toEqual({
        max_active_students: 500,
        max_courses: 20,
        max_storage_mb: 5120,
        allowed_modules: ["flashcards", "cronograma"],
      });
    });
  });

  describe("checkStudentLimit", () => {
    it("should allow unlimited students when gratuito has no cap", async () => {
      mockFrom.mockReturnValueOnce(createChain({ data: null })); // grace: empresas
      mockFrom.mockReturnValueOnce(createChain({ data: { subscription_id: null } })); // limits: empresas
      mockFrom.mockReturnValueOnce(
        createChain({
          data: {
            max_active_students: null,
            max_courses: null,
            max_storage_mb: null,
            allowed_modules: null,
          },
        })
      ); // limits: gratuito plan
      mockFrom.mockReturnValueOnce(createChain({ count: 10_000 }));

      const result = await checkStudentLimit("empresa-1");

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(10_000);
      expect(result.limit).toBeNull();
    });

    it("should block when at gratuito plan student cap", async () => {
      mockFrom.mockReturnValueOnce(createChain({ data: null }));
      mockFrom.mockReturnValueOnce(createChain({ data: { subscription_id: null } }));
      mockFrom.mockReturnValueOnce(
        createChain({
          data: {
            max_active_students: 50,
            max_courses: null,
            max_storage_mb: null,
            allowed_modules: null,
          },
        })
      );
      mockFrom.mockReturnValueOnce(createChain({ count: 50 }));

      const result = await checkStudentLimit("empresa-1");

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(50);
      expect(result.limit).toBe(50);
      expect(result.message).toContain("Limite de 50 alunos");
      expect(result.message).toContain("upgrade");
    });

    it("should block when subscription is past grace period", async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      // isWithinGracePeriod: empresa has subscription
      mockFrom.mockReturnValueOnce(createChain({ data: { subscription_id: "sub-1" } }));
      // isWithinGracePeriod: subscription is past_due beyond grace
      mockFrom.mockReturnValueOnce(createChain({
        data: { status: "past_due", updated_at: tenDaysAgo.toISOString() },
      }));

      const result = await checkStudentLimit("empresa-1");

      expect(result.allowed).toBe(false);
      expect(result.message).toContain("assinatura está vencida");
    });
  });

  describe("checkCourseLimit", () => {
    it("should allow unlimited courses when gratuito has no cap", async () => {
      mockFrom.mockReturnValueOnce(createChain({ data: null }));
      mockFrom.mockReturnValueOnce(createChain({ data: { subscription_id: null } }));
      mockFrom.mockReturnValueOnce(
        createChain({
          data: {
            max_active_students: null,
            max_courses: null,
            max_storage_mb: null,
            allowed_modules: null,
          },
        })
      );
      mockFrom.mockReturnValueOnce(createChain({ count: 100 }));

      const result = await checkCourseLimit("empresa-1");

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(100);
      expect(result.limit).toBeNull();
    });

    it("should block when at gratuito course cap", async () => {
      mockFrom.mockReturnValueOnce(createChain({ data: null }));
      mockFrom.mockReturnValueOnce(createChain({ data: { subscription_id: null } }));
      mockFrom.mockReturnValueOnce(
        createChain({
          data: {
            max_active_students: null,
            max_courses: 3,
            max_storage_mb: null,
            allowed_modules: null,
          },
        })
      );
      mockFrom.mockReturnValueOnce(createChain({ count: 3 }));

      const result = await checkCourseLimit("empresa-1");

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.limit).toBe(3);
      expect(result.message).toContain("Limite de 3 cursos");
    });
  });

  describe("checkModuleAccess", () => {
    it("should allow all modules when allowed_modules is empty (gratuito)", async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: null } }))
        .mockReturnValueOnce(
          createChain({
            data: {
              max_active_students: null,
              max_courses: null,
              max_storage_mb: null,
              allowed_modules: null,
            },
          })
        );

      const result = await checkModuleAccess("empresa-1", "flashcards");

      expect(result.allowed).toBe(true);
    });

    it("should allow included module", async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: "sub-1" } }))
        .mockReturnValueOnce(createChain({
          data: {
            status: "active",
            plan_id: "plan-1",
            subscription_plans: {
              max_active_students: null,
              max_courses: null,
              max_storage_mb: null,
              allowed_modules: ["flashcards", "cronograma"],
            },
          },
        }));

      const result = await checkModuleAccess("empresa-1", "flashcards");
      expect(result.allowed).toBe(true);
    });

    it("should deny excluded module", async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: "sub-1" } }))
        .mockReturnValueOnce(createChain({
          data: {
            status: "active",
            plan_id: "plan-1",
            subscription_plans: {
              max_active_students: null,
              max_courses: null,
              max_storage_mb: null,
              allowed_modules: ["flashcards"],
            },
          },
        }));

      const result = await checkModuleAccess("empresa-1", "cronograma");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("cronograma");
      expect(result.message).toContain("upgrade");
    });
  });

  describe("isWithinGracePeriod", () => {
    it("should return true for free tier (no subscription)", async () => {
      mockFrom.mockReturnValueOnce(createChain({ data: null }));

      const result = await isWithinGracePeriod("empresa-1");
      expect(result).toBe(true);
    });

    it("should return true for active subscription", async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: "sub-1" } }))
        .mockReturnValueOnce(createChain({
          data: { status: "active", updated_at: new Date().toISOString() },
        }));

      const result = await isWithinGracePeriod("empresa-1");
      expect(result).toBe(true);
    });

    it("should return true for trialing subscription", async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: "sub-1" } }))
        .mockReturnValueOnce(createChain({
          data: { status: "trialing", updated_at: new Date().toISOString() },
        }));

      const result = await isWithinGracePeriod("empresa-1");
      expect(result).toBe(true);
    });

    it("should return true for past_due within grace period (3 days)", async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: "sub-1" } }))
        .mockReturnValueOnce(createChain({
          data: { status: "past_due", updated_at: threeDaysAgo.toISOString() },
        }));

      const result = await isWithinGracePeriod("empresa-1");
      expect(result).toBe(true);
    });

    it("should return false for past_due beyond grace period (10 days)", async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: "sub-1" } }))
        .mockReturnValueOnce(createChain({
          data: { status: "past_due", updated_at: tenDaysAgo.toISOString() },
        }));

      const result = await isWithinGracePeriod("empresa-1");
      expect(result).toBe(false);
    });

    it("should return false for canceled subscription", async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: { subscription_id: "sub-1" } }))
        .mockReturnValueOnce(createChain({
          data: { status: "canceled", updated_at: new Date().toISOString() },
        }));

      const result = await isWithinGracePeriod("empresa-1");
      expect(result).toBe(false);
    });
  });
});
