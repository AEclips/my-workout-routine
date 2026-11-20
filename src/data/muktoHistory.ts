export interface PastGymSession {
  num: number;
  dateIso: string;
  bnDate: string;
  monthBn: 'অক্টোবর' | 'নভেম্বর';
  routineLabel: string;
  badgeText?: string;
  highlight?: boolean;
}

export const MUKTO_PROFILE = {
  name: 'Md. Hasan Shahriar (Mukto)',
  email: 'shahriarmukto8800@gmail.com',
  latestWeightKg: '66.6',
  weightDateBn: '৩১ অক্টোবর',
  totalPastDays: 14,
  octoberDaysCount: 9,
  novemberDaysCount: 5,
  lastSessionBn: 'শনিবার, ১৪ নভেম্বর • সন্ধ্যা ৬:০০ (High Intensity)',
  newRoutineStartBn: 'শনিবার, ২১ নভেম্বর থেকে',
  defaultSpreadsheetId: '1I_Q6bpWecyPyRT6EvezO_Fo77x8EXkX7AqrTG6LLags',
  defaultSheetUrl:
    'https://docs.google.com/spreadsheets/d/1I_Q6bpWecyPyRT6EvezO_Fo77x8EXkX7AqrTG6LLags/edit'
} as const;

export const PAST_GYM_SESSIONS: PastGymSession[] = [
  { num: 14, dateIso: '2026-11-14', bnDate: '১৪ নভেম্বর (শনি)', monthBn: 'নভেম্বর', routineLabel: 'পুরনো রুটিন • সন্ধ্যা ৬:০০ (High Intensity)', badgeText: 'শেষ সেশন', highlight: true },
  { num: 13, dateIso: '2026-11-11', bnDate: '১১ নভেম্বর', monthBn: 'নভেম্বর', routineLabel: 'পুরনো রুটিন' },
  { num: 12, dateIso: '2026-11-09', bnDate: '৯ নভেম্বর', monthBn: 'নভেম্বর', routineLabel: 'পুরনো রুটিন' },
  { num: 11, dateIso: '2026-11-08', bnDate: '৮ নভেম্বর', monthBn: 'নভেম্বর', routineLabel: 'পুরনো রুটিন' },
  { num: 10, dateIso: '2026-11-02', bnDate: '২ নভেম্বর', monthBn: 'নভেম্বর', routineLabel: 'পুরনো রুটিন' },
  { num: 9, dateIso: '2026-10-31', bnDate: '৩১ অক্টোবর', monthBn: 'অক্টোবর', routineLabel: 'পুরনো রুটিন • ওজন ৬৬.৬ কেজি', badgeText: '৬৬.৬ kg', highlight: true },
  { num: 8, dateIso: '2026-10-29', bnDate: '২৯ অক্টোবর', monthBn: 'অক্টোবর', routineLabel: 'পুরনো রুটিন' },
  { num: 7, dateIso: '2026-10-27', bnDate: '২৭ অক্টোবর', monthBn: 'অক্টোবর', routineLabel: 'পুরনো রুটিন' },
  { num: 6, dateIso: '2026-10-26', bnDate: '২৬ অক্টোবর', monthBn: 'অক্টোবর', routineLabel: 'পুরনো রুটিন' },
  { num: 5, dateIso: '2026-10-25', bnDate: '২৫ অক্টোবর', monthBn: 'অক্টোবর', routineLabel: 'পুরনো রুটিন' },
  { num: 4, dateIso: '2026-10-24', bnDate: '২৪ অক্টোবর', monthBn: 'অক্টোবর', routineLabel: 'পুরনো রুটিন' },
  { num: 3, dateIso: '2026-10-13', bnDate: '১৩ অক্টোবর', monthBn: 'অক্টোবর', routineLabel: 'পুরনো রুটিন' },
  { num: 2, dateIso: '2026-10-12', bnDate: '১২ অক্টোবর', monthBn: 'অক্টোবর', routineLabel: 'পুরনো রুটিন' },
  { num: 1, dateIso: '2026-10-11', bnDate: '১১ অক্টোবর', monthBn: 'অক্টোবর', routineLabel: 'পুরনো রুটিন' }
];
