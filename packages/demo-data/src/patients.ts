export const patients = {
  alex: { name: 'Alex Morgan', initials: 'AM', token: 'demo-alex-token' },
  jamie: { name: 'Jamie Taylor', initials: 'JT', token: 'demo-jamie-token' },
} as const;

export type PatientId = keyof typeof patients;
export type DemoPatient = (typeof patients)[PatientId];
