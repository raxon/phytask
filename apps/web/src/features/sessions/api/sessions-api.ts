import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { SessionResult } from '@rep-counter/contracts/session';
import { patients, type PatientId } from '@rep-counter/demo-data/patients';

export const sessionsApi = createApi({
  reducerPath: 'sessionsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/', timeout: 12000 }),
  tagTypes: ['Sessions'],
  endpoints: (builder) => ({
    getSessions: builder.query<SessionResult[], PatientId>({
      query: (patientId) => ({
        url: 'sessions',
        headers: { authorization: `Bearer ${patients[patientId].token}` },
      }),
      providesTags: (_result, _error, patientId) => [{ type: 'Sessions', id: patientId }],
    }),
    saveSession: builder.mutation<SessionResult, { patientId: PatientId; result: SessionResult }>({
      query: ({ patientId, result }) => ({
        url: 'sessions',
        method: 'POST',
        body: result,
        headers: { authorization: `Bearer ${patients[patientId].token}` },
      }),
      invalidatesTags: (_result, _error, { patientId }) => [{ type: 'Sessions', id: patientId }],
    }),
  }),
});

export const { useGetSessionsQuery } = sessionsApi;
