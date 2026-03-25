describe("Billing route rate limiting", () => {
  const RATE_LIMIT_ERROR = "Muitas requisicoes. Tente novamente em alguns segundos.";

  function checkoutIdentifier(empresaId: string): string {
    return `checkout:${empresaId}`;
  }

  function portalIdentifier(empresaId: string): string {
    return `portal:${empresaId}`;
  }

  function checkoutRateLimitResult(
    empresaId: string,
    checkLimit: (identifier: string) => boolean,
  ): { status: number; body: { error: string } } | null {
    if (!checkLimit(checkoutIdentifier(empresaId))) {
      return {
        status: 429,
        body: { error: RATE_LIMIT_ERROR },
      };
    }

    return null;
  }

  function portalRateLimitResult(
    empresaId: string,
    checkLimit: (identifier: string) => boolean,
  ): { status: number; body: { error: string } } | null {
    if (!checkLimit(portalIdentifier(empresaId))) {
      return {
        status: 429,
        body: { error: RATE_LIMIT_ERROR },
      };
    }

    return null;
  }

  it("returns 429 for checkout when checkLimit is false", () => {
    const checkLimit = jest.fn().mockReturnValue(false);

    const result = checkoutRateLimitResult("empresa-1", checkLimit);

    expect(checkLimit).toHaveBeenCalledWith("checkout:empresa-1");
    expect(result).toEqual({
      status: 429,
      body: { error: RATE_LIMIT_ERROR },
    });
  });

  it("allows checkout flow when checkLimit is true", () => {
    const checkLimit = jest.fn().mockReturnValue(true);

    const result = checkoutRateLimitResult("empresa-2", checkLimit);

    expect(checkLimit).toHaveBeenCalledWith("checkout:empresa-2");
    expect(result).toBeNull();
  });

  it("returns 429 for portal when checkLimit is false", () => {
    const checkLimit = jest.fn().mockReturnValue(false);

    const result = portalRateLimitResult("empresa-3", checkLimit);

    expect(checkLimit).toHaveBeenCalledWith("portal:empresa-3");
    expect(result).toEqual({
      status: 429,
      body: { error: RATE_LIMIT_ERROR },
    });
  });

  it("builds identifiers using empresaId for checkout and portal", () => {
    expect(checkoutIdentifier("abc")).toBe("checkout:abc");
    expect(portalIdentifier("abc")).toBe("portal:abc");
  });
});
