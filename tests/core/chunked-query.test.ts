import { describe, expect, it, jest } from "@jest/globals";
import {
  fetchAllRowsChunked,
  fetchCountChunked,
  fetchRowsChunked,
} from "@/app/shared/core/database/chunked-query";

/**
 * Cria um mock de query factory para fetchAllRowsChunked.
 *
 * Simula o comportamento do Supabase query builder: a factory recebe
 * um array de IDs e retorna um objeto com `.range()` que resolve
 * para os dados filtrados.
 */
function createMockFetchAllFactory(allData: { id: string }[]) {
  return jest.fn((chunkIds: string[]) => {
    const filtered = allData.filter((row) => chunkIds.includes(row.id));
    return {
      range: jest.fn((_from: number, _to: number) =>
        Promise.resolve({ data: filtered, error: null }),
      ),
    };
  });
}

/**
 * Cria um mock de query factory para fetchCountChunked.
 */
function createMockCountFactory(allData: { id: string }[]) {
  return jest.fn((chunkIds: string[]) => {
    const count = allData.filter((row) => chunkIds.includes(row.id)).length;
    return Promise.resolve({ count, error: null });
  });
}

/**
 * Cria um mock de query factory para fetchRowsChunked.
 */
function createMockRowsFactory(allData: { id: string }[]) {
  return jest.fn((chunkIds: string[]) => {
    const filtered = allData.filter((row) => chunkIds.includes(row.id));
    return Promise.resolve({ data: filtered, error: null });
  });
}

/**
 * Gera uma lista de IDs UUID-like para testes.
 */
function generateIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  );
}

describe("chunked-query", () => {
  describe("fetchAllRowsChunked", () => {
    it("deve retornar array vazio quando values esta vazio", async () => {
      const factory = jest.fn();
      const result = await fetchAllRowsChunked(factory, []);
      expect(result).toEqual([]);
      expect(factory).not.toHaveBeenCalled();
    });

    it("deve executar sem chunking quando array cabe em um lote", async () => {
      const ids = generateIds(5);
      const data = ids.map((id) => ({ id }));
      const factory = createMockFetchAllFactory(data);

      const result = await fetchAllRowsChunked(factory, ids);

      expect(result).toHaveLength(5);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(factory).toHaveBeenCalledWith(ids);
    });

    it("deve dividir em chunks quando array excede o limite", async () => {
      const chunkSize = 3;
      const ids = generateIds(7);
      const data = ids.map((id) => ({ id }));
      const factory = createMockFetchAllFactory(data);

      const result = await fetchAllRowsChunked(factory, ids, chunkSize);

      // 7 / 3 = 3 chunks (3 + 3 + 1)
      expect(factory).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(7);

      // Verificar que todos os IDs estao presentes no resultado
      const resultIds = result.map((r: { id: string }) => r.id);
      for (const id of ids) {
        expect(resultIds).toContain(id);
      }
    });

    it("deve funcionar com chunk size exato (sem sobra)", async () => {
      const chunkSize = 3;
      const ids = generateIds(6);
      const data = ids.map((id) => ({ id }));
      const factory = createMockFetchAllFactory(data);

      const result = await fetchAllRowsChunked(factory, ids, chunkSize);

      // 6 / 3 = 2 chunks exatos
      expect(factory).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(6);
    });

    it("deve usar DEFAULT_CHUNK_SIZE de 200 quando nao especificado", async () => {
      const ids = generateIds(201);
      const data = ids.map((id) => ({ id }));
      const factory = createMockFetchAllFactory(data);

      const result = await fetchAllRowsChunked(factory, ids);

      // 201 / 200 = 2 chunks
      expect(factory).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(201);
    });

    it("deve propagar erros do fetchAllRows", async () => {
      const factory = jest.fn(() => ({
        range: jest.fn(() =>
          Promise.resolve({ data: null, error: { message: "connection refused" } }),
        ),
      }));

      await expect(fetchAllRowsChunked(factory, ["id1"])).rejects.toThrow(
        "fetchAllRows: connection refused",
      );
    });

    it("deve tratar array com exatamente chunkSize elementos como lote unico", async () => {
      const chunkSize = 200;
      const ids = generateIds(200);
      const data = ids.map((id) => ({ id }));
      const factory = createMockFetchAllFactory(data);

      const result = await fetchAllRowsChunked(factory, ids, chunkSize);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(200);
    });
  });

  describe("fetchCountChunked", () => {
    it("deve retornar 0 quando values esta vazio", async () => {
      const factory = jest.fn();
      const result = await fetchCountChunked(factory, []);
      expect(result).toBe(0);
      expect(factory).not.toHaveBeenCalled();
    });

    it("deve executar contagem sem chunking quando array cabe em um lote", async () => {
      const ids = generateIds(5);
      const data = ids.map((id) => ({ id }));
      const factory = createMockCountFactory(data);

      const result = await fetchCountChunked(factory, ids);

      expect(result).toBe(5);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("deve somar counts de multiplos chunks", async () => {
      const chunkSize = 3;
      const ids = generateIds(7);
      const data = ids.map((id) => ({ id }));
      const factory = createMockCountFactory(data);

      const result = await fetchCountChunked(factory, ids, chunkSize);

      // 3 chunks: 3 + 3 + 1 = 7
      expect(factory).toHaveBeenCalledTimes(3);
      expect(result).toBe(7);
    });

    it("deve propagar erros do count query", async () => {
      const factory = jest.fn(() =>
        Promise.resolve({ count: null, error: { message: "table not found" } }),
      );

      await expect(fetchCountChunked(factory, ["id1"])).rejects.toThrow(
        "fetchCountChunked: table not found",
      );
    });

    it("deve tratar count null como 0", async () => {
      const factory = jest.fn(() =>
        Promise.resolve({ count: null, error: null }),
      );

      const result = await fetchCountChunked(factory, ["id1"]);
      expect(result).toBe(0);
    });
  });

  describe("fetchRowsChunked", () => {
    it("deve retornar array vazio quando values esta vazio", async () => {
      const factory = jest.fn();
      const result = await fetchRowsChunked(factory, []);
      expect(result).toEqual([]);
      expect(factory).not.toHaveBeenCalled();
    });

    it("deve executar sem chunking quando array cabe em um lote", async () => {
      const ids = generateIds(5);
      const data = ids.map((id) => ({ id }));
      const factory = createMockRowsFactory(data);

      const result = await fetchRowsChunked(factory, ids);

      expect(result).toHaveLength(5);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("deve concatenar resultados de multiplos chunks", async () => {
      const chunkSize = 3;
      const ids = generateIds(8);
      const data = ids.map((id) => ({ id }));
      const factory = createMockRowsFactory(data);

      const result = await fetchRowsChunked(factory, ids, chunkSize);

      expect(factory).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(8);
    });

    it("deve propagar erros do query", async () => {
      const factory = jest.fn(() =>
        Promise.resolve({ data: null, error: { message: "permission denied" } }),
      );

      await expect(fetchRowsChunked(factory, ["id1"])).rejects.toThrow(
        "fetchRowsChunked: permission denied",
      );
    });

    it("deve tratar data null como array vazio", async () => {
      const factory = jest.fn(() =>
        Promise.resolve({ data: null, error: null }),
      );

      const result = await fetchRowsChunked(factory, ["id1"]);
      expect(result).toEqual([]);
    });
  });
});
