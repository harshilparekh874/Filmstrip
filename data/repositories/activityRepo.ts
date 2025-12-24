
import { cloudClient } from '../api/cloudClient';
import { ActivityEvent } from '../../core/types/models';

export const activityRepo = {
  getActivityFeed: async (userId: string): Promise<ActivityEvent[]> => {
    return await cloudClient.get('/activity', { userId }) as ActivityEvent[];
  }
};
