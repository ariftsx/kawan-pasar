import type {
  AlertPreferences,
  AlertsResponse,
  MarkReadInput,
  NotificationsResponse,
  NotificationTab,
  WatchInput,
  WatchUpdate,
} from '@kawan-pasar/contracts';
import { MAX_WATCHES } from '@kawan-pasar/contracts';
import { conflict, invalidToken, notFound } from '../../common/api-errors.js';
import type { AuthTokenService } from '../auth/auth-token.service.js';
import type { UsersRepository } from '../auth/users.repository.js';
import type { AlertsRepository } from './alerts.repository.js';

/** The only market with prices and forecasts so far; watches are per market in the schema. */
const MARKET = 'PIKJ';

export class AlertsService {
  constructor(
    private readonly repo: AlertsRepository,
    private readonly users: UsersRepository,
    private readonly tokens: AuthTokenService,
  ) {}

  async overview(userId: string): Promise<AlertsResponse> {
    const [preferences, watches, user] = await Promise.all([
      this.repo.preferences(userId),
      this.repo.watches(userId),
      this.users.findById(userId),
    ]);
    return { preferences, watches, emailVerified: user !== null && user.emailVerifiedAt !== null };
  }

  savePreferences(userId: string, p: AlertPreferences): Promise<void> {
    return this.repo.savePreferences(userId, p);
  }

  async addWatch(userId: string, input: WatchInput): Promise<void> {
    if ((await this.repo.countWatches(userId)) >= MAX_WATCHES) throw conflict('limit');
    const id = await this.repo.addWatch(userId, MARKET, input.commodity, input.threshold ?? null);
    if (id === null) throw conflict('commodity');
  }

  async updateWatch(userId: string, id: number, input: WatchUpdate): Promise<void> {
    if (!(await this.repo.updateWatch(userId, id, input.threshold))) throw notFound();
  }

  async removeWatch(userId: string, id: number): Promise<void> {
    if (!(await this.repo.removeWatch(userId, id))) throw notFound();
  }

  async notifications(
    userId: string,
    tab: NotificationTab,
    before: number | undefined,
  ): Promise<NotificationsResponse> {
    const [page, unread] = await Promise.all([
      this.repo.notifications(userId, tab, before),
      this.repo.unreadCount(userId),
    ]);
    return { ...page, unread };
  }

  unreadCount(userId: string): Promise<number> {
    return this.repo.unreadCount(userId);
  }

  markRead(userId: string, input: MarkReadInput): Promise<number> {
    return this.repo.markRead(userId, 'all' in input ? 'all' : input.ids);
  }

  /** The e-mail's one-click link: no session needed, the single-use token is the proof. */
  async unsubscribeWeekly(token: string): Promise<void> {
    const userId = await this.tokens.consume(token, 'weekly_unsubscribe');
    if (userId === null) throw invalidToken();
    await this.repo.setWeekly(userId, false);
  }
}
