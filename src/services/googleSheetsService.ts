import { ALL_EXERCISES } from '../data/workoutBlueprint';
import type {
  CardCustomization,
  DailyPrepRecoveryLog
} from '../types/workout';
import type { WorkoutLogsMap } from './storageService';

export const GOOGLE_APPS_SCRIPT_CODE = `// 1. Google Sheet খুলে Extensions -> Apps Script এ যান
// 2. নিচের পুরো কোডটি পেস্ট করে Save করুন
// 3. Deploy -> New deployment -> Web app -> Who has access: "Anyone" দিয়ে Deploy করুন
// 4. পাওয়া Web App URL-টি অ্যাপের "অনলাইন ও গুগল শিট" ট্যাবে পেস্ট করুন

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ১. Workout_Logs ট্যাবে প্রতিটি সেটের বিস্তারিত এন্ট্রি সেভ
    var logSheet = getOrCreateSheet(ss, "Workout_Logs", [
      "Week", "Day", "Exercise No", "Exercise Name", "Muscle",
      "Set", "Weight (kg)", "Reps / RPM", "Completed", "Updated At"
    ]);
    if (Array.isArray(payload.flatRows) && payload.flatRows.length > 0) {
      logSheet.clearContents();
      logSheet.appendRow([
        "Week", "Day", "Exercise No", "Exercise Name", "Muscle",
        "Set", "Weight (kg)", "Reps / RPM", "Completed", "Updated At"
      ]);
      logSheet.getRange(2, 1, payload.flatRows.length, 10).setValues(payload.flatRows);
    }

    // ২. Weekly_Matrix ট্যাবে PDF-এর মতো SAT/MON/WED ও SUN/TUE/THU ছক
    var matrixSheet = getOrCreateSheet(ss, "Weekly_Matrix", [
      "Week", "Day Type", "Ex No", "Exercise", "Day Code", "Set 1", "Set 2", "Set 3", "Set 4"
    ]);
    if (Array.isArray(payload.matrixRows) && payload.matrixRows.length > 0) {
      matrixSheet.clearContents();
      matrixSheet.appendRow([
        "Week", "Day Type", "Ex No", "Exercise", "Day Code", "Set 1", "Set 2", "Set 3", "Set 4"
      ]);
      matrixSheet.getRange(2, 1, payload.matrixRows.length, 9).setValues(payload.matrixRows);
    }

    // ৩. Recovery_Nutrition ট্যাবে দৈনিক পানি, প্রোটিন, ঘুমের হিসাব
    var recSheet = getOrCreateSheet(ss, "Recovery_Nutrition", [
      "Date", "Water (ml)", "Body Weight (kg)", "Protein (g)", "Sleep (hrs)", "Pre Meal", "Post Meal", "Notes"
    ]);
    if (Array.isArray(payload.recoveryRows) && payload.recoveryRows.length > 0) {
      recSheet.clearContents();
      recSheet.appendRow([
        "Date", "Water (ml)", "Body Weight (kg)", "Protein (g)", "Sleep (hrs)", "Pre Meal", "Post Meal", "Notes"
      ]);
      recSheet.getRange(2, 1, payload.recoveryRows.length, 8).setValues(payload.recoveryRows);
    }

    // ৪. App_Backup_JSON ট্যাবে সম্পূর্ণ ব্যাকআপ (অন্য ফোনে Pull করার জন্য)
    var backupSheet = getOrCreateSheet(ss, "App_Backup_JSON", ["Key", "JSON_Data", "Updated_At"]);
    var rawJson = JSON.stringify(payload.rawState || {});
    backupSheet.clearContents();
    backupSheet.appendRow(["Key", "JSON_Data", "Updated_At"]);
    backupSheet.appendRow(["HYPERTROPHY_BD_STATE", rawJson, new Date().toISOString()]);

    return jsonOutput({ ok: true, syncedRows: (payload.flatRows || []).length, serverTime: new Date().toISOString() });
  } catch (err) {
    return jsonOutput({ ok: false, error: err.toString() });
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "status";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (action === "pull") {
      var backupSheet = ss.getSheetByName("App_Backup_JSON");
      if (!backupSheet || backupSheet.getLastRow() < 2) {
        return jsonOutput({ ok: false, error: "গুগল শিটে এখনো কোনো ব্যাকআপ সেভ করা হয়নি।" });
      }
      var raw = backupSheet.getRange(2, 2).getValue();
      return jsonOutput({ ok: true, rawState: JSON.parse(raw) });
    }
    return jsonOutput({ ok: true, message: "Hypertrophy Guide BD Google Sheet Sync Active!" });
  } catch (err) {
    return jsonOutput({ ok: false, error: err.toString() });
  }
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export interface SyncPayload {
  flatRows: (string | number)[][];
  matrixRows: string[][];
  recoveryRows: (string | number)[][];
  rawState: {
    customizations: Record<string, CardCustomization>;
    workoutLogs: WorkoutLogsMap;
    recoveryLogs: Record<string, DailyPrepRecoveryLog>;
    pushedAt: string;
  };
}

export function buildSyncPayload(
  customizations: Record<string, CardCustomization>,
  workoutLogs: WorkoutLogsMap,
  recoveryLogs: Record<string, DailyPrepRecoveryLog>
): SyncPayload {
  const exMap = new Map(ALL_EXERCISES.map((e) => [e.id, e]));
  const flatRows: (string | number)[][] = [];
  const matrixRows: string[][] = [];

  const sortedLogs = Object.values(workoutLogs).sort((a, b) =>
    `${a.weekId}_${a.dayCode}_${a.exerciseId}`.localeCompare(
      `${b.weekId}_${b.dayCode}_${b.exerciseId}`
    )
  );

  for (const log of sortedLogs) {
    const ex = exMap.get(log.exerciseId);
    if (!ex) continue;

    if (ex.isCardio && log.cardio) {
      if (log.cardio.completed || log.cardio.hrNotes) {
        flatRows.push([
          log.weekId,
          log.dayCode,
          ex.num,
          ex.name,
          ex.muscleCategory,
          '5m Bike',
          log.cardio.hrNotes || '-',
          log.cardio.rpmLevel || '-',
          log.cardio.completed ? 'DONE' : 'PENDING',
          log.cardio.completedAt || log.updatedAt
        ]);
        matrixRows.push([
          log.weekId,
          ex.routineType,
          ex.num,
          ex.name,
          log.dayCode,
          log.cardio.completed ? `Done (${log.cardio.rpmLevel})` : '-',
          log.cardio.hrNotes || '-',
          '-',
          '-'
        ]);
      }
    } else {
      const hasAnyData = log.sets.some((s) => s.completed || s.weight || s.reps);
      if (hasAnyData) {
        const sCells = [0, 1, 2, 3].map((i) => {
          const s = log.sets[i];
          if (!s || (!s.weight && !s.reps && !s.completed)) return '-';
          return `${s.weight || 'BW'}kg×${s.reps || '?'}${s.completed ? ' ✓' : ''}`;
        });
        matrixRows.push([
          log.weekId,
          ex.routineType,
          ex.num,
          ex.name,
          log.dayCode,
          sCells[0],
          sCells[1],
          sCells[2],
          sCells[3]
        ]);
      }

      for (const s of log.sets) {
        if (!s.completed && !s.weight && !s.reps) continue;
        flatRows.push([
          log.weekId,
          log.dayCode,
          ex.num,
          ex.name,
          ex.muscleCategory,
          `S${s.setNumber}`,
          s.weight || 'BW',
          s.reps || '0',
          s.completed ? 'DONE' : 'PENDING',
          s.completedAt || log.updatedAt
        ]);
      }
    }
  }

  const recoveryRows = Object.values(recoveryLogs)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((r) => [
      r.dateKey,
      r.waterMl,
      r.bodyWeightKg || '-',
      r.proteinGrams || '-',
      r.sleepHours || '-',
      r.preWorkoutMealDone ? 'YES' : 'NO',
      r.postWorkoutMealDone ? 'YES' : 'NO',
      r.notes || '-'
    ]);

  return {
    flatRows,
    matrixRows,
    recoveryRows,
    rawState: {
      customizations,
      workoutLogs,
      recoveryLogs,
      pushedAt: new Date().toISOString()
    }
  };
}

function validateAppsScriptUrl(rawUrl: string): string | null {
  const cleanUrl = rawUrl.trim();
  if (!cleanUrl.startsWith('http')) {
    return 'সঠিক Google Apps Script Web App URL দিন।';
  }
  if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    return 'এটি Google Sheet-এর লিংক! দয়া করে Apps Script থেকে Deploy -> Web App URL (script.google.com/.../exec) দিন।';
  }
  return null;
}

export async function pushToGoogleSheets(
  webAppUrl: string,
  payload: SyncPayload
): Promise<{ ok: boolean; message: string; syncedRows: number }> {
  const errMsg = validateAppsScriptUrl(webAppUrl);
  if (errMsg) {
    return { ok: false, message: errMsg, syncedRows: 0 };
  }
  const cleanUrl = webAppUrl.trim();

  // Using text/plain avoids CORS preflight OPTIONS requests on Google Apps Script
  const res = await fetch(cleanUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const rawText = await res.text();
  let data: { ok?: boolean; error?: string; syncedRows?: number };
  try {
    data = JSON.parse(rawText) as { ok?: boolean; error?: string; syncedRows?: number };
  } catch {
    throw new Error('Google Apps Script সঠিক JSON উত্তর দেয়নি। Deploy এ "Anyone" অ্যাক্সেস আছে কি না চেক করুন।');
  }
  if (!data.ok) {
    throw new Error(data.error || 'Google Sheet সিঙ্ক ব্যর্থ হয়েছে।');
  }

  return {
    ok: true,
    message: `সফলভাবে ${data.syncedRows ?? payload.flatRows.length}টি সেট ডেটা গুগল শিটে সেভ হয়েছে!`,
    syncedRows: data.syncedRows ?? payload.flatRows.length
  };
}

export async function pullFromGoogleSheets(webAppUrl: string): Promise<{
  ok: boolean;
  rawState?: SyncPayload['rawState'];
  message: string;
}> {
  const errMsg = validateAppsScriptUrl(webAppUrl);
  if (errMsg) {
    return { ok: false, message: errMsg };
  }
  const cleanUrl = webAppUrl.trim();

  const sep = cleanUrl.includes('?') ? '&' : '?';
  const res = await fetch(`${cleanUrl}${sep}action=pull`, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const rawText = await res.text();
  let data: {
    ok?: boolean;
    error?: string;
    rawState?: SyncPayload['rawState'];
  };
  try {
    data = JSON.parse(rawText) as {
      ok?: boolean;
      error?: string;
      rawState?: SyncPayload['rawState'];
    };
  } catch {
    throw new Error('Google Apps Script থেকে বৈধ JSON ডেটা পাওয়া যায়নি।');
  }
  if (!data.ok || !data.rawState) {
    return { ok: false, message: data.error || 'গুগল শিট থেকে ডেটা পাওয়া যায়নি।' };
  }
  return {
    ok: true,
    rawState: data.rawState,
    message: 'গুগল শিট থেকে সব অফলাইন ডেটা সফলভাবে লোড হয়েছে!'
  };
}
