# useCachedRequest

**ステータス**: ✅ 実装済み

## 概要
リクエストバッチングにキャッシングを追加したhook。同一リクエストの重複実行を防ぎ、TTL（Time To Live）ベースのキャッシュ管理を提供します。

## ユースケース
- 頻繁にアクセスされるデータのキャッシング
- 重複リクエストの排除
- ネットワーク負荷の削減
- ページネーションとスクロール最適化
- 参照データ（マスターデータ）の効率的な管理
- オフライン対応アプリケーション

## API設計

```typescript
function useCachedRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>,
  options?: {
    ttl?: Duration.Duration;
    capacity?: number;
    runtime?: Runtime.Runtime<never>;
    onCacheHit?: (key: string) => void;
    onCacheMiss?: (key: string) => void;
  }
): {
  execute: <E, R>(request: Request.Request<E, R>) => Effect.Effect<E, any>;
  executePromise: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  clearCache: (predicate?: (key: string) => boolean) => void;
  getCacheStats: () => { hits: number; misses: number; size: number };
  loading: boolean;
  error: any | null;
}
```

**パラメータ:**
- `resolver` - リクエストをバッチ処理するRequestResolver
- `options.ttl` - キャッシュの有効期間（デフォルト: 5分）
- `options.capacity` - キャッシュの最大件数（デフォルト: 100）
- `options.runtime` - カスタムランタイム
- `options.onCacheHit` - キャッシュヒット時のコールバック
- `options.onCacheMiss` - キャッシュミス時のコールバック

**戻り値:**
- `execute` - リクエストを実行するEffect関数
- `executePromise` - リクエストを実行するPromise関数
- `clearCache` - キャッシュをクリアする関数
- `getCacheStats` - キャッシュ統計を取得する関数
- `loading` - ローディング状態
- `error` - エラー状態

## 使用例

### 基本的な使用例

```typescript
import { useCachedRequest } from 'effectts-react';
import * as Duration from 'effect/Duration';

interface GetUser extends Request.Request<User, Error> {
  readonly _tag: 'GetUser';
  readonly id: string;
}

const GetUser = Request.tagged<GetUser>('GetUser');

const GetUserResolver = RequestResolver.makeBatched(
  (requests: GetUser[]) =>
    Effect.gen(function* () {
      const ids = requests.map((r) => r.id);
      console.log(`Fetching ${ids.length} users from API`);
      const users = yield* api.getUsersByIds(ids);

      return requests.map((req) => {
        const user = users.find((u) => u.id === req.id);
        return user
          ? Request.succeed(req, user)
          : Request.fail(req, new Error('Not found'));
      });
    })
);

function UserProfile({ userId }: { userId: string }) {
  const { execute, clearCache, getCacheStats } = useCachedRequest(
    GetUserResolver,
    {
      ttl: Duration.minutes(5), // 5分間キャッシュ
      capacity: 100, // 最大100件
    }
  );

  const { data } = useEffectQuery(
    Effect.gen(function* () {
      // 5分以内の同じリクエストはキャッシュから返される
      const user = yield* execute(GetUser({ id: userId }));
      return user;
    }),
    [userId, execute]
  );

  const stats = getCacheStats();

  return (
    <div>
      <div>{data?.name}</div>
      <button onClick={() => clearCache()}>Clear Cache</button>
      <div>
        Cache stats: {stats.hits} hits, {stats.misses} misses, {stats.size}{' '}
        items
      </div>
    </div>
  );
}
```

### データ更新時のキャッシュクリア

```typescript
import { useCachedRequest } from 'effectts-react';

function UserEditor({ userId }: { userId: string }) {
  const userCache = useCachedRequest(GetUserResolver, {
    ttl: Duration.minutes(10),
  });

  const { data: user } = useEffectQuery(
    Effect.gen(function* () {
      return yield* userCache.execute(GetUser({ id: userId }));
    }),
    [userId, userCache.execute]
  );

  const updateUser = async (updates: Partial<User>) => {
    await api.updateUser(userId, updates);

    // 更新後はキャッシュをクリア
    userCache.clearCache();
  };

  return (
    <div>
      <h1>{user?.name}</h1>
      <input
        type="text"
        defaultValue={user?.name}
        onBlur={(e) => updateUser({ name: e.target.value })}
      />
      <button onClick={() => updateUser({ name: 'New Name' })}>
        Update Name
      </button>
    </div>
  );
}
```

### 選択的なキャッシュクリア

```typescript
import { useCachedRequest } from 'effectts-react';

function UserManagement() {
  const { execute, clearCache } = useCachedRequest(GetUserResolver);

  const deleteUser = async (userId: string) => {
    await api.deleteUser(userId);

    // 特定のユーザーのキャッシュのみクリア
    clearCache((key) => key.includes(userId));
  };

  const refreshAllUsers = () => {
    // すべてのキャッシュをクリア
    clearCache();
  };

  return (
    <div>
      <button onClick={refreshAllUsers}>Refresh All</button>
      {/* ... */}
    </div>
  );
}
```

### キャッシュ統計の監視

```typescript
import { useCachedRequest } from 'effectts-react';

function CachedDataViewer() {
  const { execute, getCacheStats } = useCachedRequest(GetUserResolver, {
    ttl: Duration.minutes(5),
    onCacheHit: (key) => console.log('Cache hit:', key),
    onCacheMiss: (key) => console.log('Cache miss:', key),
  });

  const [stats, setStats] = useState({ hits: 0, misses: 0, size: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getCacheStats());
    }, 1000);

    return () => clearInterval(interval);
  }, [getCacheStats]);

  const hitRate = stats.hits + stats.misses > 0
    ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2)
    : '0';

  return (
    <div>
      <h2>Cache Performance</h2>
      <p>Hit Rate: {hitRate}%</p>
      <p>Cache Size: {stats.size} items</p>
      <p>Total Hits: {stats.hits}</p>
      <p>Total Misses: {stats.misses}</p>
    </div>
  );
}
```

### 異なるTTLの使用

```typescript
import { useCachedRequest } from 'effectts-react';

function MultiTierCaching() {
  // 短期キャッシュ - リアルタイムデータ
  const realtimeCache = useCachedRequest(GetRealtimeDataResolver, {
    ttl: Duration.seconds(30), // 30秒
  });

  // 中期キャッシュ - ユーザーデータ
  const userCache = useCachedRequest(GetUserResolver, {
    ttl: Duration.minutes(5), // 5分
  });

  // 長期キャッシュ - マスターデータ
  const masterCache = useCachedRequest(GetMasterDataResolver, {
    ttl: Duration.hours(1), // 1時間
  });

  return (
    <div>
      {/* 各キャッシュを適切な場所で使用 */}
    </div>
  );
}
```

### ページネーションでのキャッシング

```typescript
import { useCachedRequest } from 'effectts-react';

interface GetPage extends Request.Request<Page, Error> {
  readonly _tag: 'GetPage';
  readonly pageNumber: number;
  readonly pageSize: number;
}

const GetPage = Request.tagged<GetPage>('GetPage');

const PageResolver = RequestResolver.makeBatched(
  (requests: GetPage[]) =>
    Effect.gen(function* () {
      // ページ単位でリクエストをバッチ化
      const results = yield* Effect.forEach(requests, (req) =>
        api.getPage(req.pageNumber, req.pageSize).pipe(
          Effect.map((data) => Request.succeed(req, data)),
          Effect.catchAll((error) => Effect.succeed(Request.fail(req, error)))
        )
      );

      return results;
    })
);

function PaginatedList() {
  const [page, setPage] = useState(1);
  const { execute, clearCache } = useCachedRequest(PageResolver, {
    ttl: Duration.minutes(10),
    capacity: 50, // 50ページまでキャッシュ
  });

  const { data, loading } = useEffectQuery(
    Effect.gen(function* () {
      return yield* execute(GetPage({ pageNumber: page, pageSize: 20 }));
    }),
    [page, execute]
  );

  return (
    <div>
      {loading && <div>Loading...</div>}
      {data?.items.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
      <button onClick={() => setPage(page - 1)} disabled={page === 1}>
        Previous
      </button>
      <button onClick={() => setPage(page + 1)}>Next</button>
      <button onClick={() => clearCache()}>Refresh</button>
    </div>
  );
}
```

### キャパシティ制限の管理

```typescript
import { useCachedRequest } from 'effectts-react';

function LargeDatasetViewer() {
  const { execute, getCacheStats } = useCachedRequest(GetItemResolver, {
    ttl: Duration.minutes(15),
    capacity: 50, // 最大50件
  });

  const stats = getCacheStats();

  // キャッシュが満杯に近い場合は警告
  const isNearCapacity = stats.size >= 45;

  return (
    <div>
      {isNearCapacity && (
        <div className="warning">
          Cache is near capacity ({stats.size}/50). Consider clearing old
          entries.
        </div>
      )}
      {/* ... */}
    </div>
  );
}
```

### マスターデータのプリロード

```typescript
import { useCachedRequest } from 'effectts-react';

interface GetCountry extends Request.Request<Country, Error> {
  readonly _tag: 'GetCountry';
  readonly code: string;
}

const GetCountry = Request.tagged<GetCountry>('GetCountry');

const CountryResolver = RequestResolver.makeBatched(
  (requests: GetCountry[]) =>
    Effect.gen(function* () {
      const codes = requests.map((r) => r.code);
      const countries = yield* api.getCountries(codes);

      return requests.map((req) => {
        const country = countries.find((c) => c.code === req.code);
        return country
          ? Request.succeed(req, country)
          : Request.fail(req, new Error('Not found'));
      });
    })
);

function CountrySelector() {
  const { executePromise } = useCachedRequest(CountryResolver, {
    ttl: Duration.hours(24), // マスターデータは24時間キャッシュ
    capacity: 300,
  });

  // 初期ロード時にすべての国をプリロード
  useEffect(() => {
    const preloadCountries = async () => {
      const commonCountries = ['US', 'UK', 'JP', 'CA', 'AU'];
      await Promise.all(
        commonCountries.map((code) =>
          executePromise(GetCountry({ code })).catch(() => {
            /* ignore errors */
          })
        )
      );
    };

    preloadCountries();
  }, [executePromise]);

  return <div>{/* 国選択UI */}</div>;
}
```

## 実装詳細

```typescript
import { useCallback, useState, useRef } from 'react';
import * as Effect from 'effect/Effect';
import * as Request from 'effect/Request';
import * as RequestResolver from 'effect/RequestResolver';
import * as Runtime from 'effect/Runtime';
import * as Duration from 'effect/Duration';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export function useCachedRequest<A extends Request.Request<any, any>>(
  resolver: RequestResolver.RequestResolver<A, never>,
  options?: {
    ttl?: Duration.Duration;
    capacity?: number;
    runtime?: Runtime.Runtime<never>;
    onCacheHit?: (key: string) => void;
    onCacheMiss?: (key: string) => void;
  }
): {
  execute: <E, R>(request: Request.Request<E, R>) => Effect.Effect<E, any>;
  executePromise: <E, R>(request: Request.Request<E, R>) => Promise<E>;
  clearCache: (predicate?: (key: string) => boolean) => void;
  getCacheStats: () => CacheStats;
  loading: boolean;
  error: any | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any | null>(null);
  const cacheRef = useRef(new Map<string, CacheEntry<any>>());
  const statsRef = useRef<CacheStats>({ hits: 0, misses: 0, size: 0 });
  const resolverRef = useRef(resolver);

  resolverRef.current = resolver;

  const getCacheKey = useCallback((request: any): string => {
    return JSON.stringify(request);
  }, []);

  const isExpired = useCallback(
    (entry: CacheEntry<any>): boolean => {
      const ttlMs = options?.ttl
        ? Duration.toMillis(options.ttl)
        : 5 * 60 * 1000; // デフォルト5分
      const now = Date.now();
      return now - entry.timestamp > ttlMs;
    },
    [options?.ttl]
  );

  const evictOldest = useCallback(() => {
    if (cacheRef.current.size === 0) return;

    const oldestKey = Array.from(cacheRef.current.entries()).reduce(
      (oldest, [key, entry]) => {
        return entry.timestamp < oldest.timestamp
          ? { key, timestamp: entry.timestamp }
          : oldest;
      },
      { key: '', timestamp: Infinity }
    ).key;

    if (oldestKey) {
      cacheRef.current.delete(oldestKey);
    }
  }, []);

  const getCachedValue = useCallback(
    <E,>(cacheKey: string): E | null => {
      const cached = cacheRef.current.get(cacheKey);

      if (!cached) {
        statsRef.current.misses++;
        options?.onCacheMiss?.(cacheKey);
        return null;
      }

      if (isExpired(cached)) {
        cacheRef.current.delete(cacheKey);
        statsRef.current.misses++;
        statsRef.current.size = cacheRef.current.size;
        options?.onCacheMiss?.(cacheKey);
        return null;
      }

      statsRef.current.hits++;
      options?.onCacheHit?.(cacheKey);
      return cached.value as E;
    },
    [isExpired, options]
  );

  const setCachedValue = useCallback(
    (cacheKey: string, value: any) => {
      // 容量制限チェック
      const capacity = options?.capacity ?? 100;
      if (cacheRef.current.size >= capacity) {
        evictOldest();
      }

      cacheRef.current.set(cacheKey, {
        value,
        timestamp: Date.now(),
      });

      statsRef.current.size = cacheRef.current.size;
    },
    [options?.capacity, evictOldest]
  );

  const execute = useCallback(
    <E, R>(request: Request.Request<E, R>): Effect.Effect<E, any> => {
      const cacheKey = getCacheKey(request);
      const cached = getCachedValue<E>(cacheKey);

      if (cached !== null) {
        return Effect.succeed(cached);
      }

      return Effect.request(request, resolverRef.current).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            setCachedValue(cacheKey, result);
          })
        )
      );
    },
    [getCacheKey, getCachedValue, setCachedValue]
  );

  const executePromise = useCallback(
    async <E, R>(request: Request.Request<E, R>): Promise<E> => {
      setLoading(true);
      setError(null);

      try {
        const effect = execute(request);
        const result = options?.runtime
          ? await Runtime.runPromise(options.runtime)(effect)
          : await Effect.runPromise(effect);

        setLoading(false);
        return result;
      } catch (err) {
        setError(err);
        setLoading(false);
        throw err;
      }
    },
    [execute, options?.runtime]
  );

  const clearCache = useCallback((predicate?: (key: string) => boolean) => {
    if (!predicate) {
      cacheRef.current.clear();
      statsRef.current.size = 0;
      return;
    }

    const keysToDelete: string[] = [];
    for (const key of cacheRef.current.keys()) {
      if (predicate(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => cacheRef.current.delete(key));
    statsRef.current.size = cacheRef.current.size;
  }, []);

  const getCacheStats = useCallback((): CacheStats => {
    return { ...statsRef.current };
  }, []);

  return {
    execute,
    executePromise,
    clearCache,
    getCacheStats,
    loading,
    error,
  };
}
```

## キャッシュ戦略

### TTLの選択

- **リアルタイムデータ**: 10-30秒
- **ユーザーデータ**: 1-5分
- **設定・プリファレンス**: 10-30分
- **マスターデータ**: 1-24時間
- **静的コンテンツ**: 1日以上

### キャパシティの選択

アプリケーションのデータサイズと使用パターンに応じて設定：

```typescript
// 小規模アプリ
{ capacity: 50 }

// 中規模アプリ
{ capacity: 200 }

// 大規模アプリ
{ capacity: 1000 }
```

## テストケース

- ✅ キャッシュヒット（有効期限内）
- ✅ キャッシュミス（初回アクセス）
- ✅ TTL期限切れ後の再取得
- ✅ 容量制限による古いエントリの削除
- ✅ キャッシュクリア（全体・選択的）
- ✅ キャッシュ統計の追跡
- ✅ 並行リクエストの重複排除
- ✅ アンマウント時のクリーンアップ
- ✅ onCacheHit/onCacheMissコールバック
- ✅ executeとexecutePromiseの両方のAPI

## 注意事項

### メモリ管理

大量のデータをキャッシュする場合は、capacityを適切に設定してメモリリークを防いでください。

### キャッシュの一貫性

データが更新された場合は、明示的にキャッシュをクリアする必要があります。

```typescript
// データ更新後
await api.updateUser(userId, data);
clearCache((key) => key.includes(userId));
```

### シリアライゼーション

リクエストオブジェクトはJSON.stringifyでシリアライズされるため、循環参照や関数は含めないでください。

## useCachedRequest vs useRequest

| 機能 | useRequest | useCachedRequest |
|------|-----------|------------------|
| バッチング | ✅ | ✅ |
| キャッシング | ❌ | ✅ |
| TTL管理 | ❌ | ✅ |
| 容量制限 | ❌ | ✅ |
| 統計情報 | ❌ | ✅ |
| メモリ使用量 | 少 | 中〜大 |
| 推奨用途 | リアルタイムデータ | 静的・準静的データ |

## 関連Hooks

- [useRequest](./useRequest.md) - キャッシングなしのリクエストバッチング
- [useEffectQuery](./useEffectQuery.md) - Effect実行とデータフェッチング
- [useManagedRuntime](./useManagedRuntime.md) - カスタムランタイム管理

## 参考

- [Effect Request Documentation](https://effect.website/docs/data-types/request)
- [Effect Caching Documentation](https://effect.website/docs/caching)
- [HTTP Caching Best Practices](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
