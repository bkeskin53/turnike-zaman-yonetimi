import type { EmployeeImportIssueSummaryDto } from "@/src/services/employees/employeeImportIssueTaxonomy.service";
import type { EmployeeImportReadinessSummaryDto } from "@/src/services/employees/employeeImportReadiness.service";

export type EmployeeImportGuidedRemediationActionKey =
  | "OPEN_ISSUES"
  | "DOWNLOAD_CORRECTION_PACK"
  | "OPEN_PREVIEW"
  | "OPEN_TECHNICAL"
  | "APPLY_NOW"
  | "OPEN_RUN_DETAIL";

export type EmployeeImportGuidedRemediationActionDto = {
  key: EmployeeImportGuidedRemediationActionKey;
  title: string;
  description: string;
  emphasis: "primary" | "secondary";
};

export type EmployeeImportGuidedRemediationPlanDto = {
  headline: string;
  supportText: string;
  actions: EmployeeImportGuidedRemediationActionDto[];
  topConcernTitles: string[];
};

export function buildEmployeeImportGuidedRemediationPlan(args: {
  readinessSummary: EmployeeImportReadinessSummaryDto | null | undefined;
  issueSummary: EmployeeImportIssueSummaryDto;
  hasApplySummary: boolean;
  rejectedCount: number;
  hasIssueDetails: boolean;
  hasPreviewRows: boolean;
  hasTechnicalDetails: boolean;
  hasRunRef: boolean;
  canReadHistory: boolean;
  canApply: boolean;
  applyEnabled: boolean;
}): EmployeeImportGuidedRemediationPlanDto | null {
  const topConcernTitles = args.readinessSummary?.topConcerns.map((item) => item.title).slice(0, 3) ?? [];
  const hasCorrectionPack = args.hasRunRef && (args.issueSummary.totalErrorCount > 0 || args.issueSummary.totalWarningCount > 0);
  const actions: EmployeeImportGuidedRemediationActionDto[] = [];

  const pushAction = (action: EmployeeImportGuidedRemediationActionDto | null) => {
    if (!action) return;
    if (actions.some((item) => item.key === action.key)) return;
    actions.push(action);
  };

  if (args.hasApplySummary) {
    if (args.rejectedCount <= 0) {
      return null;
    }

    pushAction(
      hasCorrectionPack
        ? {
            key: "DOWNLOAD_CORRECTION_PACK",
            title: "Reddedilen satırları indir",
            description: "Kalan satırları düzeltmek için sınırlı düzeltme paketini açın.",
            emphasis: "primary",
          }
        : null,
    );
    pushAction(
      args.hasIssueDetails
        ? {
            key: "OPEN_ISSUES",
            title: "Reddedilen satırları aç",
            description: "Hata ve uyarı kayıtlarını ekranda satır bazında inceleyin.",
            emphasis: "secondary",
          }
        : null,
    );
    pushAction(
      args.hasRunRef && args.canReadHistory
        ? {
            key: "OPEN_RUN_DETAIL",
            title: "İşlem kaydına git",
            description: "Operasyon detayını ve dışa aktarma araçlarını detay panelinden takip edin.",
            emphasis: "secondary",
          }
        : null,
    );

    return {
      headline: "Kalan satırları düzeltmek için sonraki adımlar",
      supportText: "Bu koşu tamamlandı ancak bazı satırlar reddedildi. Düzeltme paketini indirip satır bazlı kayıtlarla devam edebilirsiniz.",
      actions,
      topConcernTitles,
    };
  }

  if (!args.readinessSummary) return null;

  if (args.readinessSummary.status === "BLOCKED") {
    pushAction(
      args.hasIssueDetails
        ? {
            key: "OPEN_ISSUES",
            title: "Düzeltilecek satırları aç",
            description: "Bloklayan sorun kayıtlarını satır bazında açıp neyin düzeltilmesi gerektiğini görün.",
            emphasis: "primary",
          }
        : null,
    );
    pushAction(
      hasCorrectionPack
        ? {
            key: "DOWNLOAD_CORRECTION_PACK",
            title: "Düzeltme paketini indir",
            description: "Excel'de açılabilir, maskelenmiş düzeltme paketini indirip ekiple paylaşın.",
            emphasis: "secondary",
          }
        : null,
    );
    pushAction(
      args.hasTechnicalDetails
        ? {
            key: "OPEN_TECHNICAL",
            title: "Teknik özeti aç",
            description: "Başlık sözleşmesi ve kod çözümleme ayrıntılarını ikinci adımda kontrol edin.",
            emphasis: "secondary",
          }
        : null,
    );

    return {
      headline: "Önce düzeltmeleri tamamlayın",
      supportText: "Hazırlık özetine göre bu dosya henüz uygulamaya hazır değil. İlk adım bloklayan satırları açmak ve gerekirse düzeltme paketini indirmek olmalı.",
      actions,
      topConcernTitles,
    };
  }

  if (args.readinessSummary.status === "REVIEW") {
    pushAction(
      args.hasIssueDetails
        ? {
            key: "OPEN_ISSUES",
            title: "Uyarı ve notları gözden geçir",
            description: "Uygulamaya geçmeden önce dikkat gerektiren satırları açıp inceleyin.",
            emphasis: "primary",
          }
        : null,
    );
    pushAction(
      args.hasPreviewRows
        ? {
            key: "OPEN_PREVIEW",
            title: "Önizleme satırlarını kontrol et",
            description: "İlk satırları ve uygulanacak alanları hızlı bir son kontrol için açın.",
            emphasis: "secondary",
          }
        : null,
    );
    pushAction(
      args.canApply && args.applyEnabled
        ? {
            key: "APPLY_NOW",
            title: "Hazırsan uygula",
            description: "Uyarılar kabul edilebilir seviyedeyse uygulama adımına geçebilirsiniz.",
            emphasis: "secondary",
          }
        : null,
    );

    return {
      headline: "Uygulamadan önce kısa bir son kontrol önerilir",
      supportText: "Dosya uygulanabilir görünüyor ancak uyarı sinyalleri var. Hedeflenen satırları son kez kontrol edip sonra uygulamaya geçebilirsiniz.",
      actions,
      topConcernTitles,
    };
  }

  pushAction(
    args.canApply && args.applyEnabled
      ? {
          key: "APPLY_NOW",
          title: "Uygulamaya geç",
          description: "Hazırlık özeti temiz. Dosyayı mevcut haliyle uygulayabilirsiniz.",
          emphasis: "primary",
        }
      : null,
  );
  pushAction(
    args.hasPreviewRows
      ? {
          key: "OPEN_PREVIEW",
          title: "Önizleme satırlarını aç",
          description: "Uygulamadan hemen önce ilk satırları görmek isterseniz önizlemeyi kullanın.",
          emphasis: "secondary",
        }
      : null,
  );
  pushAction(
    args.hasRunRef && args.canReadHistory
      ? {
          key: "OPEN_RUN_DETAIL",
          title: "İşlem kaydını incele",
          description: "Doğrulama kaydını detay panelinden açıp geçmiş tarafında inceleyin.",
          emphasis: "secondary",
        }
      : null,
  );

  return {
    headline: "Dosya hazır, isterseniz şimdi uygulayabilirsiniz",
    supportText: "Temel kontroller temiz görünüyor. Son bir göz atmak isterseniz önizleme satırlarını açabilir veya doğrulama kaydına gidebilirsiniz.",
    actions,
    topConcernTitles,
  };
}
