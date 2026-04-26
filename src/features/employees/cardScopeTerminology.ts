export const employeeCardScopeTerms = {
  profileTitle: "Vardiya Bilgileri",
  profileSubtitle: "Çalışma programı özeti ve temel vardiya göstergeleri",
  masterNavLabel: "Kimlik Bilgileri",
  masterPageTitle: "Personel Kimlik Bilgileri",
  masterPageSubtitle: "Kimlik ve özlük bilgilerinin detay görünümü",
  masterSectionTitle: "Kart Aktivasyon bilgileri",
  masterSectionSubtitle: "Kart başlangıç, kart bitiş ve kayıt durumunun temel görünümü",
  startDateLabel: "Kart Aktivasyon Tarihi",
  endDateLabel: "Kart İptal Tarihi",
  summaryLabel: "Kapsam Özeti",
  summaryEmpty: "Kart kapsam tarihi bilgisi tanımlı değil.",
  summaryStarted: "Kart aktivasyon tarihi tanımlı.",
  summaryEnded: "Kart kapsamı iptal edilmiş.",
  terminateActionLabel: "Kapsam Sonlandırıldı",
  rehireActionLabel: "Yeni Kapsam Açıldı",
  terminateModalTitle: "Zaman Kapsamını Sonlandır",
  terminateModalApplyLabel: "Sonlandırmayı Uygula",
  terminateDateLabel: "Kapsam Bitiş Tarihi",
  terminateSuccessPrefix: "Kapsam sonlandırıldı.",
  terminatePlaceholder: "Kart iptali / kapsam kapatma / vb.",
  rehireModalTitle: "Yeni Zaman Kapsamı Aç",
  rehireModalApplyLabel: "Yeni Kapsamı Aç",
  rehireDateLabel: "Kapsam Başlangıç Tarihi",
  rehireSuccessPrefix: "Yeni kapsam açıldı.",
  rehirePlaceholder: "Kart yeniden aktivasyon / kapsam açma / vb.",
  invalidStartDate: "Kapsam başlangıç tarihi geçersiz. (YYYY-AA-GG)",
  invalidEndDate: "Kapsam bitiş tarihi geçersiz. (YYYY-AA-GG)",
  noOpenScope: "Açık kart kapsamı bulunamadı (zaten kapalı olabilir).",
  endBeforeStart: "Kapsam bitiş tarihi, kart aktivasyon tarihinden önce olamaz.",
  scopeOverlap: "Bu tarihte çakışan bir kart kapsamı var. Başka tarih deneyin.",
} as const;

export function trEmployeeScopeActionType(actionType: string): string {
  switch (String(actionType ?? "").trim()) {
    case "HIRE":
      return "Kapsama Alındı";
    case "REHIRE":
      return employeeCardScopeTerms.rehireActionLabel;
    case "TERMINATE":
      return employeeCardScopeTerms.terminateActionLabel;
    case "UPDATE":
      return "Güncellendi";
    default:
      return actionType;
  }
}

export function trEmployeeScopeApiError(code: string): string {
  switch (String(code ?? "").trim()) {
    case "INVALID_END_DATE":
      return employeeCardScopeTerms.invalidEndDate;
    case "INVALID_START_DATE":
      return employeeCardScopeTerms.invalidStartDate;
    case "NO_OPEN_EMPLOYMENT":
      return employeeCardScopeTerms.noOpenScope;
    case "END_BEFORE_START":
      return employeeCardScopeTerms.endBeforeStart;
    case "EMPLOYMENT_OVERLAP":
      return employeeCardScopeTerms.scopeOverlap;
    case "server_error":
      return "Sunucu hatası oluştu. Tekrar deneyin.";
    case "UNAUTHORIZED":
      return "Oturum bulunamadı. Lütfen tekrar giriş yapın.";
    case "FORBIDDEN":
      return "Bu işlem için yetkiniz yok.";
    default:
      return code;
  }
}