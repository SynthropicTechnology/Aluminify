/**
 * Suite de testes: Core - Cache Service
 *
 * Testa o serviço de cache in-memory:
 * - get/set: operações básicas de cache
 * - TTL: expiração de entradas
 * - del/delMany: remoção de entradas
 * - getOrSet: padrão cache-aside
 * - clearAll: limpeza total
 * - isEnabled/isDisabled: configuração
 */

// Importar diretamente a classe para testar instâncias isoladas
// Como o módulo exporta um singleton, vamos testar o comportamento via import dinâmico

describe("CacheService", () => {
  let CacheServiceClass: any;
  let cache: any;

  beforeEach(async () => {
    // Limpar cache de módulos para obter instância limpa
    jest.resetModules();

    // Garantir que cache não está desabilitado
    delete process.env.CACHE_DISABLED;
    delete process.env.NEXT_PUBLIC_CACHE_DISABLED;

    // Importar dinamicamente para obter instância limpa
    const mod = await import(
      "@/app/shared/core/services/cache/cache.service"
    );
    cache = mod.cacheService;
    cache.clearAll();
  });

  // ===========================================================================
  // get / set básico
  // ===========================================================================

  describe("get e set", () => {
    it("deve armazenar e recuperar um valor", async () => {
      await cache.set("test-key", { name: "valor" }, 60);
      const result = await cache.get("test-key");
      expect(result).toEqual({ name: "valor" });
    });

    it("deve armazenar valores de tipos diferentes", async () => {
      await cache.set("string-key", "hello", 60);
      await cache.set("number-key", 42, 60);
      await cache.set("boolean-key", true, 60);
      await cache.set("array-key", [1, 2, 3], 60);
      await cache.set("null-key", null, 60);

      expect(await cache.get("string-key")).toBe("hello");
      expect(await cache.get("number-key")).toBe(42);
      expect(await cache.get("boolean-key")).toBe(true);
      expect(await cache.get("array-key")).toEqual([1, 2, 3]);
      // null é tratado como cache miss
      expect(await cache.get("null-key")).toBeNull();
    });

    it("deve retornar null para chave inexistente", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("deve sobrescrever valor existente", async () => {
      await cache.set("key", "valor1", 60);
      await cache.set("key", "valor2", 60);

      expect(await cache.get("key")).toBe("valor2");
    });
  });

  // ===========================================================================
  // TTL (Time To Live)
  // ===========================================================================

  describe("TTL e expiração", () => {
    it("deve retornar null após TTL expirar", async () => {
      // Usar Date.now mock para simular passagem de tempo
      const originalDateNow = Date.now;
      let currentTime = originalDateNow();

      Date.now = jest.fn(() => currentTime);

      await cache.set("expiring-key", "value", 1); // 1 segundo TTL

      // Antes de expirar
      const before = await cache.get("expiring-key");
      expect(before).toBe("value");

      // Avançar tempo em 2 segundos
      currentTime += 2000;

      const after = await cache.get("expiring-key");
      expect(after).toBeNull();

      Date.now = originalDateNow;
    });

    it("deve usar TTL padrão de 3600s quando não especificado", async () => {
      const originalDateNow = Date.now;
      let currentTime = originalDateNow();
      Date.now = jest.fn(() => currentTime);

      await cache.set("default-ttl-key", "value");

      // Avançar 59 minutos (3540s) - ainda não expirou
      currentTime += 3540 * 1000;
      expect(await cache.get("default-ttl-key")).toBe("value");

      // Avançar mais 2 minutos (total 61min) - expirou
      currentTime += 120 * 1000;
      expect(await cache.get("default-ttl-key")).toBeNull();

      Date.now = originalDateNow;
    });
  });

  // ===========================================================================
  // del / delMany
  // ===========================================================================

  describe("del e delMany", () => {
    it("deve deletar uma chave", async () => {
      await cache.set("to-delete", "value", 60);
      expect(await cache.get("to-delete")).toBe("value");

      await cache.del("to-delete");
      expect(await cache.get("to-delete")).toBeNull();
    });

    it("deve não falhar ao deletar chave inexistente", async () => {
      await expect(cache.del("nonexistent")).resolves.not.toThrow();
    });

    it("deve deletar múltiplas chaves", async () => {
      await cache.set("key1", "v1", 60);
      await cache.set("key2", "v2", 60);
      await cache.set("key3", "v3", 60);

      await cache.delMany(["key1", "key3"]);

      expect(await cache.get("key1")).toBeNull();
      expect(await cache.get("key2")).toBe("v2");
      expect(await cache.get("key3")).toBeNull();
    });
  });

  // ===========================================================================
  // getOrSet (cache-aside pattern)
  // ===========================================================================

  describe("getOrSet", () => {
    it("deve chamar fetcher quando cache está vazio e cachear resultado", async () => {
      const fetcher = jest.fn().mockResolvedValue({ data: "fresh" });

      const result = await cache.getOrSet("aside-key", fetcher, 60);

      expect(result).toEqual({ data: "fresh" });
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Segunda chamada não deve chamar fetcher
      const result2 = await cache.getOrSet("aside-key", fetcher, 60);
      expect(result2).toEqual({ data: "fresh" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("deve usar valor cacheado quando disponível", async () => {
      await cache.set("prefilled", "cached-value", 60);

      const fetcher = jest.fn().mockResolvedValue("new-value");
      const result = await cache.getOrSet("prefilled", fetcher, 60);

      expect(result).toBe("cached-value");
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("deve chamar fetcher novamente após TTL expirar", async () => {
      const originalDateNow = Date.now;
      let currentTime = originalDateNow();
      Date.now = jest.fn(() => currentTime);

      let callCount = 0;
      const fetcher = jest.fn().mockImplementation(async () => {
        callCount++;
        return `value-${callCount}`;
      });

      // Primeira chamada
      const result1 = await cache.getOrSet("ttl-aside", fetcher, 1);
      expect(result1).toBe("value-1");

      // Expirar TTL
      currentTime += 2000;

      // Segunda chamada - deve chamar fetcher de novo
      const result2 = await cache.getOrSet("ttl-aside", fetcher, 1);
      expect(result2).toBe("value-2");
      expect(fetcher).toHaveBeenCalledTimes(2);

      Date.now = originalDateNow;
    });
  });

  // ===========================================================================
  // clearAll
  // ===========================================================================

  describe("clearAll", () => {
    it("deve limpar todas as entradas do cache", async () => {
      await cache.set("a", 1, 60);
      await cache.set("b", 2, 60);
      await cache.set("c", 3, 60);

      cache.clearAll();

      expect(await cache.get("a")).toBeNull();
      expect(await cache.get("b")).toBeNull();
      expect(await cache.get("c")).toBeNull();
    });
  });

  // ===========================================================================
  // isEnabled / disabled
  // ===========================================================================

  describe("isEnabled e controle de desabilitação", () => {
    it("deve estar habilitado por padrão", () => {
      expect(cache.isEnabled()).toBe(true);
    });

    it("deve estar desabilitado quando CACHE_DISABLED=true", async () => {
      process.env.CACHE_DISABLED = "true";

      // Reimportar para pegar nova env
      jest.resetModules();
      const mod = await import(
        "@/app/shared/core/services/cache/cache.service"
      );
      const disabledCache = mod.cacheService;

      expect(disabledCache.isEnabled()).toBe(false);

      // Operações devem ser no-op
      await disabledCache.set("disabled-key", "value", 60);
      expect(await disabledCache.get("disabled-key")).toBeNull();

      delete process.env.CACHE_DISABLED;
    });

    it("deve estar desabilitado quando CACHE_DISABLED=1", async () => {
      process.env.CACHE_DISABLED = "1";

      jest.resetModules();
      const mod = await import(
        "@/app/shared/core/services/cache/cache.service"
      );
      expect(mod.cacheService.isEnabled()).toBe(false);

      delete process.env.CACHE_DISABLED;
    });

    it("deve funcionar quando cache está desabilitado via getOrSet", async () => {
      process.env.CACHE_DISABLED = "true";

      jest.resetModules();
      const mod = await import(
        "@/app/shared/core/services/cache/cache.service"
      );
      const disabledCache = mod.cacheService;

      const fetcher = jest.fn().mockResolvedValue("fresh");

      // getOrSet com cache desabilitado: fetcher é chamado,
      // mas set é no-op, então null é retornado do get
      // Na verdade, getOrSet chama get (retorna null), depois fetcher, depois set (no-op), retorna valor
      const result = await disabledCache.getOrSet("disabled-aside", fetcher, 60);
      expect(result).toBe("fresh");
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Porém o valor não fica cacheado
      const result2 = await disabledCache.getOrSet("disabled-aside", fetcher, 60);
      expect(result2).toBe("fresh");
      expect(fetcher).toHaveBeenCalledTimes(2); // Chamou de novo

      delete process.env.CACHE_DISABLED;
    });
  });
});
