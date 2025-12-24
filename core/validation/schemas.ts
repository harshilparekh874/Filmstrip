
import { z } from 'zod';

export const MovieEntrySchema = z.object({
  status: z.enum(['WATCHED', 'WATCH_LATER', 'DROPPED']),
  rating: z.number().min(1).max(10).optional(),
  droppedReason: z.string().optional().refine((val) => {
    // If status is DROPPED, we want a reason, though for MVP we might be lenient
    return true;
  }, { message: "Reason is required for dropped movies" }),
  notes: z.string().max(500).optional(),
});

export type MovieEntryFormData = z.infer<typeof MovieEntrySchema>;
