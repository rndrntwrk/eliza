import type { AppRepository } from "@/lib/domain/app/app-repository";

export class GetAppRequestsOverTimeUseCase {
  constructor(private readonly apps: AppRepository) {}

  execute(
    appId: string,
    periodType: "hourly" | "daily" | "monthly",
    startDate: Date,
    endDate: Date,
  ): Promise<unknown> {
    return this.apps.getRequestsOverTime(appId, periodType, startDate, endDate);
  }
}
