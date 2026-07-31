import {
  supabase,
  supabaseConfigError
} from './config/supabaseClient';
import React, { useEffect, useState, useRef } from 'react';
import LandingPage from './components/LandingPage';
import PreferencesPage from './components/PreferencesPage';
import IngredientsPage from './components/IngredientsPage';
import MainPage from './components/MainPage';
import LanguageToggle from './components/LanguageToggle';
import { createIngredientId, ensureIngredientIds } from './utils/ingredientIds';
import {
  buildGuestImportCandidate,
  normalizePreferences
} from './utils/userData';
import { useLanguage } from './i18n/LanguageContext';

const LS_KEYS = { 
  INGREDIENTS: 'fm_ingredients_v1', 
  PREFERENCES: 'fm_preferences_v1', 
  STEP: 'fm_step_v1', 
  ADD_STORAGE: 'fm_addStorage_v1' 
};

const DEFAULT_PREFERENCES = { 
  tastes: [], 
  quickMeals: false, 
  allergens: [], 
  dietType: [], 
  restrictions: [], 
  periodRestrictions: [], 
  considerNutrition: false 
};

function loadFromLocalStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('localStorage load failed:', key, e);
    return fallback;
  }
}

function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage save failed:', key, e);
  }
}

function getScopedStorageKey(baseKey, userId = null) {
  return `${baseKey}:${userId ? `user:${userId}` : 'guest'}`;
}

function loadScopedData(baseKey, userId, fallback, legacyFallback = false) {
  const scopedKey = getScopedStorageKey(baseKey, userId);
  const scopedValue = loadFromLocalStorage(scopedKey, null);
  if (scopedValue !== null) return scopedValue;
  return legacyFallback
    ? loadFromLocalStorage(baseKey, fallback)
    : fallback;
}

const mapToDB = (item, userId) => ({
  id: item.id || createIngredientId(),
  user_id: userId,
  name: item.name,
  amount: item.amount,
  unit: item.unit,
  storage: item.storage === 'room' ? 'pantry' : item.storage,
  category: item.category || 'other',
  shelf_life: item.shelfLife ?? 7,
  purchase_date: item.purchaseDate,
  updated_at: new Date().toISOString()
});

const mapFromDB = (item) => ({
  ...item,
  storage: item.storage === 'room' ? 'pantry' : item.storage,
  shelfLife: item.shelf_life ?? 7,
  purchaseDate: item.purchase_date
});

const mapPreferencesFromDB = (cloudPrefs) => normalizePreferences({
  tastes: cloudPrefs?.tastes || [],
  quickMeals: cloudPrefs?.quick_meals || false,
  allergens: cloudPrefs?.allergens || [],
  dietType: cloudPrefs?.diet_type || [],
  restrictions: cloudPrefs?.restrictions || [],
  periodRestrictions: cloudPrefs?.period_restrictions || [],
  considerNutrition: cloudPrefs?.consider_nutrition || false
});

function getSyncLabel(status, t) {
  if (status === 'loading') {
    return t('🔄 正在加载云端数据...', '🔄 Loading cloud data...');
  }
  if (status === 'syncing') {
    return t('🔄 正在同步...', '🔄 Syncing...');
  }
  if (status === 'error') {
    return t('⚠️ 云端同步失败', '⚠️ Cloud sync failed');
  }
  return t('☁️ 已同步', '☁️ Synced');
}

function enqueueSync(queueRef, task) {
  queueRef.current = queueRef.current
    .catch(() => undefined)
    .then(task);
}

export default function App() {
  const { t, isEnglish } = useLanguage();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(() => loadFromLocalStorage(LS_KEYS.STEP, 'landing'));
  const [preferences, setPreferences] = useState(() =>
    normalizePreferences(
      loadScopedData(LS_KEYS.PREFERENCES, null, DEFAULT_PREFERENCES, true)
    )
  );
  const [ingredients, setIngredients] = useState(() =>
    ensureIngredientIds(
      loadScopedData(LS_KEYS.INGREDIENTS, null, [], true)
    )
  );
  const [addStorage, setAddStorage] = useState(() => loadFromLocalStorage(LS_KEYS.ADD_STORAGE, 'fridge'));
  const [preferencesReturnStep, setPreferencesReturnStep] = useState('ingredients');
  const [syncStatus, setSyncStatus] = useState('local');
  const [guestImportCandidate, setGuestImportCandidate] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const cloudReadyForUser = useRef(null);
  const skipNextIngredientPersist = useRef(false);
  const skipNextPreferencePersist = useRef(false);
  const ingredientSyncQueue = useRef(Promise.resolve());
  const preferenceSyncQueue = useRef(Promise.resolve());
  const ingredientSyncRevision = useRef(0);
  const preferenceSyncRevision = useRef(0);
  const authUserId = useRef(null);

  /* -------- 1. 监听登录状态 -------- */
  useEffect(() => {
    if (!supabase) {
      authUserId.current = null;
      setUser(null);
      setSyncStatus('local');
      return undefined;
    }

    const applySession = (session) => {
      const nextUser = session?.user ?? null;
      const nextUserId = nextUser?.id ?? null;

      if (authUserId.current !== nextUserId) {
        authUserId.current = nextUserId;
        setSyncStatus(nextUser ? 'loading' : 'local');
      }
      setUser(nextUser);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* -------- 2. 切换本地数据作用域，并在登录后拉取云端 -------- */
  useEffect(() => {
    const userId = user?.id || null;
    let cancelled = false;

    cloudReadyForUser.current = null;
    setGuestImportCandidate(null);
    ingredientSyncRevision.current += 1;
    preferenceSyncRevision.current += 1;
    skipNextIngredientPersist.current = true;
    skipNextPreferencePersist.current = true;

    if (!userId) {
      const guestIngredients = ensureIngredientIds(
        loadScopedData(LS_KEYS.INGREDIENTS, null, [], true)
      );
      const guestPreferences = normalizePreferences(
        loadScopedData(
          LS_KEYS.PREFERENCES,
          null,
          DEFAULT_PREFERENCES,
          true
        )
      );
      setIngredients(guestIngredients);
      setPreferences(guestPreferences);
      setSyncStatus('local');
      return undefined;
    }

    const cachedIngredients = ensureIngredientIds(
      loadScopedData(LS_KEYS.INGREDIENTS, userId, [])
    );
    const cachedPreferences = normalizePreferences(
      loadScopedData(
        LS_KEYS.PREFERENCES,
        userId,
        DEFAULT_PREFERENCES
      )
    );
    setIngredients(cachedIngredients);
    setPreferences(cachedPreferences);
    setSyncStatus('loading');

    const fetchCloudData = async () => {
      const [ingredientsResult, preferencesResult] = await Promise.all([
        supabase
          .from('ingredients')
          .select('*')
          .eq('user_id', userId),
        supabase
          .from('preferences')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
      ]);

      if (cancelled) return;

      if (ingredientsResult.error || preferencesResult.error) {
        console.error(
          'Cloud load failed:',
          ingredientsResult.error || preferencesResult.error
        );
        setSyncStatus('error');
        return;
      }

      const cloudIngredients = ensureIngredientIds(
        (ingredientsResult.data || []).map(mapFromDB)
      );
      const cloudPreferences = preferencesResult.data
        ? mapPreferencesFromDB(preferencesResult.data)
        : { ...DEFAULT_PREFERENCES };
      const guestIngredients = ensureIngredientIds(
        loadScopedData(LS_KEYS.INGREDIENTS, null, [], true)
      );
      const guestPreferences = normalizePreferences(
        loadScopedData(
          LS_KEYS.PREFERENCES,
          null,
          DEFAULT_PREFERENCES,
          true
        )
      );
      const guestCandidate = buildGuestImportCandidate({
        userId,
        cloudIngredients,
        cloudPreferences,
        guestIngredients,
        guestPreferences
      });

      skipNextIngredientPersist.current = true;
      skipNextPreferencePersist.current = true;
      setIngredients(cloudIngredients);
      setPreferences(cloudPreferences);
      saveToLocalStorage(
        getScopedStorageKey(LS_KEYS.INGREDIENTS, userId),
        cloudIngredients
      );
      saveToLocalStorage(
        getScopedStorageKey(LS_KEYS.PREFERENCES, userId),
        cloudPreferences
      );
      cloudReadyForUser.current = userId;
      setSyncStatus('synced');

      setGuestImportCandidate(guestCandidate);
    };

    fetchCloudData();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /* -------- 3. 自动跳关：登录直接进主页 -------- */
  useEffect(() => {
    if (user && step === 'landing') {
      setStep('main');
    }
  }, [user, step]);

  /* -------- 4. 按用户隔离本地缓存，并带防抖同步云端 -------- */
  useEffect(() => {
    const revision = ++preferenceSyncRevision.current;

    if (skipNextPreferencePersist.current) {
      skipNextPreferencePersist.current = false;
      return undefined;
    }

    const userId = user?.id || null;
    saveToLocalStorage(
      getScopedStorageKey(LS_KEYS.PREFERENCES, userId),
      preferences
    );

    if (!userId || cloudReadyForUser.current !== userId) return undefined;

    const preferencesSnapshot = {
      tastes: [...preferences.tastes],
      quickMeals: preferences.quickMeals,
      allergens: [...preferences.allergens],
      dietType: [...preferences.dietType],
      restrictions: [...preferences.restrictions],
      periodRestrictions: [...preferences.periodRestrictions],
      considerNutrition: preferences.considerNutrition
    };
    const isCurrentSync = () =>
      revision === preferenceSyncRevision.current &&
      cloudReadyForUser.current === userId;

    const syncPrefs = async () => {
      if (!isCurrentSync()) return;

      setSyncStatus('syncing');
      const { error } = await supabase.from('preferences').upsert({
        id: userId,
        tastes: preferencesSnapshot.tastes,
        quick_meals: preferencesSnapshot.quickMeals,
        allergens: preferencesSnapshot.allergens,
        diet_type: preferencesSnapshot.dietType,
        restrictions: preferencesSnapshot.restrictions,
        period_restrictions: preferencesSnapshot.periodRestrictions,
        consider_nutrition: preferencesSnapshot.considerNutrition,
        updated_at: new Date().toISOString()
      });

      if (!isCurrentSync()) return;

      if (error) {
        console.error('Preference sync failed:', error);
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
      }
    };

    const timer = setTimeout(() => {
      enqueueSync(preferenceSyncQueue, syncPrefs);
    }, 1000);
    return () => clearTimeout(timer);
  }, [preferences, user?.id]);

  useEffect(() => {
    const revision = ++ingredientSyncRevision.current;

    if (skipNextIngredientPersist.current) {
      skipNextIngredientPersist.current = false;
      return undefined;
    }

    const userId = user?.id || null;
    saveToLocalStorage(
      getScopedStorageKey(LS_KEYS.INGREDIENTS, userId),
      ingredients
    );

    if (!userId || cloudReadyForUser.current !== userId) return undefined;

    const ingredientsSnapshot = ingredients.map((item) => ({ ...item }));
    const isCurrentSync = () =>
      revision === ingredientSyncRevision.current &&
      cloudReadyForUser.current === userId;

    const syncIngredients = async () => {
      if (!isCurrentSync()) return;

      setSyncStatus('syncing');

      if (ingredientsSnapshot.length === 0) {
        const { error } = await supabase
          .from('ingredients')
          .delete()
          .eq('user_id', userId);

        if (!isCurrentSync()) return;

        if (error) {
          console.error('Ingredient clear failed:', error);
          setSyncStatus('error');
        } else {
          setSyncStatus('synced');
        }
        return;
      }

      const ingredientsForDB = ingredientsSnapshot.map((item) =>
        mapToDB(item, userId)
      );
      const { error: upsertError } = await supabase
        .from('ingredients')
        .upsert(ingredientsForDB, { onConflict: 'id' });

      if (!isCurrentSync()) return;

      if (upsertError) {
        console.error('Ingredient upsert failed:', upsertError);
        setSyncStatus('error');
        return;
      }

      const { data: cloudRows, error: listError } = await supabase
        .from('ingredients')
        .select('id')
        .eq('user_id', userId);

      if (!isCurrentSync()) return;

      if (listError) {
        console.error('Ingredient cleanup check failed:', listError);
        setSyncStatus('error');
        return;
      }

      const currentIds = new Set(
        ingredientsSnapshot.map((item) => item.id)
      );
      const staleIds = (cloudRows || [])
        .map((row) => row.id)
        .filter((id) => !currentIds.has(id));

      if (staleIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('ingredients')
          .delete()
          .eq('user_id', userId)
          .in('id', staleIds);

        if (!isCurrentSync()) return;

        if (deleteError) {
          console.error('Ingredient cleanup failed:', deleteError);
          setSyncStatus('error');
          return;
        }
      }

      setSyncStatus('synced');
    };

    const timer = setTimeout(() => {
      enqueueSync(ingredientSyncQueue, syncIngredients);
    }, 800);
    return () => clearTimeout(timer);
  }, [ingredients, user?.id]);

  useEffect(() => {
    saveToLocalStorage(LS_KEYS.STEP, step);
  }, [step]);

  useEffect(() => {
    saveToLocalStorage(LS_KEYS.ADD_STORAGE, addStorage);
  }, [addStorage]);

  /* -------- 5. 交互操作 -------- */
  const clearFridge = () => {
    if (
      window.confirm(
        t(
          '确定要清空冰箱吗？此操作不可撤销。',
          'Clear all ingredients? This action cannot be undone.'
        )
      )
    ) {
      setIngredients([]);
    }
  };

  const goAddIngredients = (storage = 'fridge') => {
    setAddStorage(storage);
    setStep('ingredients');
  };

  const goPreferences = (returnStep = 'ingredients') => {
    setPreferencesReturnStep(returnStep);
    setStep('preferences');
  };

  const importGuestData = () => {
    if (
      !guestImportCandidate ||
      guestImportCandidate.userId !== user?.id
    ) {
      setGuestImportCandidate(null);
      return;
    }

    if (guestImportCandidate.ingredients) {
      setIngredients(
        ensureIngredientIds(guestImportCandidate.ingredients)
      );
    }
    if (guestImportCandidate.preferences) {
      setPreferences(
        normalizePreferences(guestImportCandidate.preferences)
      );
    }
    setGuestImportCandidate(null);
  };

  const handleSignOut = async () => {
    if (!supabase || signingOut) return;

    setSigningOut(true);
    setSignOutError('');

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        setSignOutError(
          t(
            `退出登录失败：${error.message}`,
            `Sign out failed: ${error.message}`
          )
        );
        return;
      }

      authUserId.current = null;
      cloudReadyForUser.current = null;
      ingredientSyncRevision.current += 1;
      preferenceSyncRevision.current += 1;
      setGuestImportCandidate(null);
      setUser(null);
      setSyncStatus('local');
      setStep('landing');
    } catch (error) {
      setSignOutError(
        t(
          `退出登录失败：${error?.message || '请检查网络后重试'}`,
          `Sign out failed: ${
            error?.message || 'Check your connection and try again'
          }`
        )
      );
    } finally {
      setSigningOut(false);
    }
  };

  const isInitialCloudLoad =
    Boolean(user) && syncStatus === 'loading';

  return (
    <div className="min-h-screen bg-gray-50">
      <LanguageToggle />

      {supabaseConfigError && (
        <div
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <strong>
            {t('云端同步暂不可用：', 'Cloud sync is unavailable: ')}
          </strong>
          {isEnglish
            ? 'Required Supabase environment variables are missing. Configure them in Vercel and redeploy. Local mode is still available.'
            : `${supabaseConfigError}。请在 Vercel 配置后重新部署；目前仍可使用本地模式。`}
        </div>
      )}

      {signOutError && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {signOutError}
        </div>
      )}

      {user && guestImportCandidate && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {t(
                '检测到此浏览器的访客模式中有',
                'Guest mode in this browser contains'
              )}
              {guestImportCandidate.ingredients
                ? t(
                    ` ${guestImportCandidate.ingredients.length} 项食材`,
                    ` ${guestImportCandidate.ingredients.length} ingredient(s)`
                  )
                : ''}
              {guestImportCandidate.ingredients &&
              guestImportCandidate.preferences
                ? t('和', ' and ')
                : ''}
              {guestImportCandidate.preferences
                ? t('偏好设置', 'preferences')
                : ''}
              {t(
                '，而当前账号对应的云端数据为空。是否导入到',
                ', while this account has no corresponding cloud data. Import them into'
              )}
              <strong> {user.email}</strong>？
            </span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setGuestImportCandidate(null)}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 font-medium text-blue-800"
              >
                {t('暂不导入', 'Not now')}
              </button>
              <button
                type="button"
                onClick={importGuestData}
                className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"
              >
                {t('导入当前账号', 'Import')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 状态栏 */}
      {user && (
        <div
          className={`p-2 text-[10px] text-right border-b flex justify-between items-center px-4 ${
            syncStatus === 'error'
              ? 'bg-red-50 text-red-700 border-red-100'
              : 'bg-green-50 text-green-600 border-green-100'
          }`}
        >
          <span>{getSyncLabel(syncStatus, t)}</span>
          <div className="flex items-center gap-3">
            <span>👤 {user.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-md border border-current px-2 py-1 font-medium disabled:cursor-wait disabled:opacity-50"
            >
              {signingOut
                ? t('退出中…', 'Signing out…')
                : t('退出登录', 'Sign out')}
            </button>
          </div>
        </div>
      )}

      {isInitialCloudLoad && (
        <div
          role="status"
          className="flex min-h-[70vh] items-center justify-center p-6"
        >
          <div className="max-w-md rounded-2xl border border-blue-100 bg-white p-8 text-center shadow-lg">
            <div className="mb-4 text-4xl">☁️</div>
            <h1 className="text-xl font-bold text-gray-900">
              {t(
                '正在加载你的云端冰箱',
                'Loading your cloud fridge'
              )}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {t(
                '加载完成前暂不开放编辑，避免本地修改被云端旧数据覆盖。',
                'Editing is paused until loading finishes so cloud data cannot overwrite new local changes.'
              )}
            </p>
          </div>
        </div>
      )}

      {!isInitialCloudLoad && step === 'landing' && (
        <LandingPage
          onNext={() => goPreferences('ingredients')}
          cloudAvailable={Boolean(supabase)}
        />
      )}
      
      {!isInitialCloudLoad && step === 'preferences' && (
        <PreferencesPage 
          preferences={preferences} 
          setPreferences={setPreferences} 
          onNext={() => setStep(preferencesReturnStep)} 
          onSkip={() => setStep(preferencesReturnStep)} 
        />
      )}

      {!isInitialCloudLoad && step === 'ingredients' && (
        <IngredientsPage
          key={user?.id || 'guest'}
          ingredients={ingredients}
          setIngredients={setIngredients}
          user={user}
          addStorage={addStorage}
          setAddStorage={setAddStorage}
          onComplete={() => setStep('main')}
          onBack={() => setStep('main')}
        />
      )}

      {!isInitialCloudLoad && step === 'main' && (
        <MainPage 
          ingredients={ingredients} 
          setIngredients={setIngredients} 
          preferences={preferences} 
          onBack={() => goAddIngredients('fridge')} 
          onClearFridge={clearFridge} 
          addStorage={addStorage} 
          onAddToStorage={goAddIngredients} 
          onEditPreferences={() => goPreferences('main')}
        />
      )}
    </div>
  );
}
