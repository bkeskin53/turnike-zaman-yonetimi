export type EmployeeImportSheetKind = "ALL_FIELDS" | "FULL_DATA" | "PERSONAL_DATA" | "ORG_DATA" | "WORK_DATA";

export type EmployeeImportFieldKey =
  | "employeeCode"
  | "firstName"
  | "lastName"
  | "nationalId"
  | "gender"
  | "email"
  | "phone"
  | "cardNo"
  | "scopeStartDate"
  | "scopeEndDate"
  | "companyCode"
  | "branchCode"
  | "employeeGroupCode"
  | "employeeSubgroupCode"
  | "workSchedulePatternCode"
  | "hireDate"
  | "terminationDate"
  | "employmentAction"
  | "isActive";

export type EmployeeImportFieldDefinition = {
  key: EmployeeImportFieldKey;
  label: string;
  description: string;
};

export type EmployeeImportSheetDefinition = {
  kind: EmployeeImportSheetKind;
  sheetName: string;
  title: string;
  description: string;
  importable: boolean;
  headers: EmployeeImportFieldKey[];
  required: EmployeeImportFieldKey[];
  sampleRows: Array<Partial<Record<EmployeeImportFieldKey, string>>>;
};

export const EMPLOYEE_IMPORT_REFERENCE_SHEET_KIND: EmployeeImportSheetKind = "ALL_FIELDS";

export const EMPLOYEE_IMPORT_FIELDS: Record<EmployeeImportFieldKey, EmployeeImportFieldDefinition> = {
  employeeCode: {
    key: "employeeCode",
    label: "Sicil",
    description: "Çalışanı tanımlayan ana çalışan kodu.",
  },
  firstName: {
    key: "firstName",
    label: "Ad",
    description: "Çalışanın adı.",
  },
  lastName: {
    key: "lastName",
    label: "Soyad",
    description: "Çalışanın soyadı.",
  },
  nationalId: {
    key: "nationalId",
    label: "TC Kimlik No",
    description: "Opsiyonel kişisel veri. Sonradan ayrıca gönderilebilir.",
  },
  gender: {
    key: "gender",
    label: "Cinsiyet",
    description: "Opsiyonel kişisel veri.",
  },
  email: {
    key: "email",
    label: "E-posta",
    description: "Opsiyonel kişisel veri.",
  },
  phone: {
    key: "phone",
    label: "Telefon",
    description: "Opsiyonel kişisel veri.",
  },
  cardNo: {
    key: "cardNo",
    label: "Kart ID",
    description: "Kart / terminal kimliğinde kullanılan kart numarası.",
  },
  scopeStartDate: {
    key: "scopeStartDate",
    label: "Kapsam Başlangıç Tarihi",
    description: "Bu satırın etkili olmaya başladığı iş tarihi (YYYY-MM-DD).",
  },
  scopeEndDate: {
    key: "scopeEndDate",
    label: "Kapsam Bitiş Tarihi",
    description: "Opsiyonel kapanış tarihi (YYYY-MM-DD). Açık kapsam için boş bırakılabilir.",
  },
  companyCode: {
    key: "companyCode",
    label: "Şirket Kodu",
    description: "Opsiyonel. Tek şirketli kurulumlarda boş bırakılabilir.",
  },
  branchCode: {
    key: "branchCode",
    label: "Lokasyon Kodu",
    description: "Çalışanın bağlı olacağı lokasyon / branch kodu.",
  },
  employeeGroupCode: {
    key: "employeeGroupCode",
    label: "Grup Kodu",
    description: "Çalışanın grup kodu.",
  },
  employeeSubgroupCode: {
    key: "employeeSubgroupCode",
    label: "Alt Grup Kodu",
    description: "Çalışanın alt grup kodu.",
  },
  workSchedulePatternCode: {
    key: "workSchedulePatternCode",
    label: "Çalışma Planı Kodu",
    description: "Çalışanın atanacağı çalışma planı kodu.",
  },
  hireDate: {
    key: "hireDate",
    label: "İşe Giriş Tarihi",
    description: "Opsiyonel istihdam başlangıç tarihi.",
  },
  terminationDate: {
    key: "terminationDate",
    label: "İşten Çıkış Tarihi",
    description: "Opsiyonel istihdam bitiş tarihi.",
  },
  employmentAction: {
    key: "employmentAction",
    label: "İstihdam Aksiyonu",
    description: "Opsiyonel. HIRE / TERMINATE / REHIRE.",
  },
  isActive: {
    key: "isActive",
    label: "Aktif mi",
    description: "Opsiyonel görünüm alanı. true / false.",
  },
};

export const EMPLOYEE_IMPORT_SHEETS: EmployeeImportSheetDefinition[] = [
  {
    kind: "ALL_FIELDS",
    sheetName: "00_Tum_Alanlar",
    title: "Tüm Başlıklar",
    description: "Bu tab referans sözlüğüdür. Zorunlu / opsiyonel alanları ve kolon isimlerini gösterir; import için kullanılmaz.",
    importable: false,
    headers: [
      "employeeCode",
      "firstName",
      "lastName",
      "nationalId",
      "gender",
      "email",
      "phone",
      "cardNo",
      "scopeStartDate",
      "scopeEndDate",
      "companyCode",
      "branchCode",
      "employeeGroupCode",
      "employeeSubgroupCode",
      "workSchedulePatternCode",
      "hireDate",
      "terminationDate",
      "employmentAction",
      "isActive",
    ],
    required: [],
    sampleRows: [],
  },
  {
    kind: "FULL_DATA",
    sheetName: "10_Tam_Toplu_Aktarim",
    title: "Tam Toplu Aktarım",
    importable: true,
    description: "İlk geçiş ve tek seferlik tam yükleme için tüm ana alanları tek tabloda toplar.",
    headers: [
      "employeeCode",
      "firstName",
      "lastName",
      "nationalId",
      "gender",
      "email",
      "phone",
      "cardNo",
      "scopeStartDate",
      "scopeEndDate",
      "companyCode",
      "branchCode",
      "employeeGroupCode",
      "employeeSubgroupCode",
      "workSchedulePatternCode",
      "hireDate",
      "terminationDate",
      "employmentAction",
      "isActive",
    ],
    required: [
      "employeeCode",
      "firstName",
      "lastName",
      "cardNo",
      "scopeStartDate",
      "branchCode",
      "employeeGroupCode",
      "employeeSubgroupCode",
      "workSchedulePatternCode",
    ],
    sampleRows: [
      {
        employeeCode: "E001",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        nationalId: "12345678901",
        gender: "FEMALE",
        email: "ayse.yilmaz@firma.com",
        phone: "05321234567",
        cardNo: "CARD-1001",
        scopeStartDate: "2026-04-01",
        scopeEndDate: "",
        companyCode: "",
        branchCode: "IST-MERKEZ",
        employeeGroupCode: "WHITE",
        employeeSubgroupCode: "WHITE-OFIS",
        workSchedulePatternCode: "NORM",
        hireDate: "2026-04-01",
        terminationDate: "",
        employmentAction: "HIRE",
        isActive: "true",
      },
    ],
  },
  {
    kind: "PERSONAL_DATA",
    sheetName: "20_Kisisel_Veriler",
    title: "Kişisel Veriler",
    importable: true,
    description: "Kimlik / özlük alanlarını güncellemek içindir. TC gibi veriler sonradan sadece bu tab ile gönderilebilir.",
    headers: [
      "employeeCode",
      "firstName",
      "lastName",
      "nationalId",
      "gender",
      "email",
      "phone",
      "cardNo",
      "scopeStartDate",
      "scopeEndDate",
    ],
    required: ["employeeCode", "cardNo", "scopeStartDate"],
    sampleRows: [
      {
        employeeCode: "E001",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        nationalId: "12345678901",
        gender: "FEMALE",
        email: "ayse.yilmaz@firma.com",
        phone: "05321234567",
        cardNo: "CARD-1001",
        scopeStartDate: "2026-04-01",
        scopeEndDate: "",
      },
    ],
  },
  {
    kind: "ORG_DATA",
    sheetName: "30_Organizasyon_Verileri",
    title: "Organizasyon Verileri",
    importable: true,
    description: "Şirket / lokasyon / grup / alt grup alanlarını taşır.",
    headers: [
      "employeeCode",
      "cardNo",
      "scopeStartDate",
      "scopeEndDate",
      "companyCode",
      "branchCode",
      "employeeGroupCode",
      "employeeSubgroupCode",
    ],
    required: ["employeeCode", "cardNo", "scopeStartDate", "branchCode", "employeeGroupCode", "employeeSubgroupCode"],
    sampleRows: [
      {
        employeeCode: "E001",
        cardNo: "CARD-1001",
        scopeStartDate: "2026-04-01",
        scopeEndDate: "",
        companyCode: "",
        branchCode: "IST-MERKEZ",
        employeeGroupCode: "WHITE",
        employeeSubgroupCode: "WHITE-OFIS",
      },
    ],
  },
  {
    kind: "WORK_DATA",
    sheetName: "40_Calisma_Verileri",
    title: "Çalışma Verileri",
    importable: true,
    description: "Çalışma planı / vardiya planı taşıyan tabdır.",
    headers: ["employeeCode", "cardNo", "scopeStartDate", "scopeEndDate", "workSchedulePatternCode"],
    required: ["employeeCode", "cardNo", "scopeStartDate", "workSchedulePatternCode"],
    sampleRows: [
      {
        employeeCode: "E001",
        cardNo: "CARD-1001",
        scopeStartDate: "2026-04-01",
        scopeEndDate: "",
        workSchedulePatternCode: "NORM",
      },
    ],
  },
];

export function getEmployeeImportSheet(kind: EmployeeImportSheetKind): EmployeeImportSheetDefinition {
  const found = EMPLOYEE_IMPORT_SHEETS.find((item) => item.kind === kind);
  if (!found) {
    throw new Error(`Unknown employee import sheet kind: ${kind}`);
  }
  return found;
}

export function getEmployeeImportSheetByName(name: string): EmployeeImportSheetDefinition | null {
  const normalized = normalizeEmployeeImportHeader(name);
  return (
    EMPLOYEE_IMPORT_SHEETS.find((item) => normalizeEmployeeImportHeader(item.sheetName) === normalized) ?? null
  );
}

export function getEmployeeImportReferenceSheet(): EmployeeImportSheetDefinition {
  return getEmployeeImportSheet(EMPLOYEE_IMPORT_REFERENCE_SHEET_KIND);
}

export function listEmployeeImportableSheetTitles(): string[] {
  return EMPLOYEE_IMPORT_SHEETS.filter((item) => item.importable).map((item) => item.title);
}

export function formatEmployeeImportSheetTitle(kind: string, fallbackTitle?: string | null): string {
  const normalizedKind = String(kind ?? "").trim().toUpperCase();
  const matched = EMPLOYEE_IMPORT_SHEETS.find((item) => item.kind === normalizedKind);
  if (matched) return matched.title;

  const normalizedFallback = String(fallbackTitle ?? "").trim();
  if (normalizedFallback) return normalizedFallback;

  return normalizedKind || "Bilinmeyen Tab";
}

export function normalizeEmployeeImportHeader(value: string): string {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

export function buildTemplateMatrix(sheet: EmployeeImportSheetDefinition): string[][] {
  if (!sheet.importable) {
    return [
      ["field", "label", "requiredInSheets", "description"],
      ...Object.values(EMPLOYEE_IMPORT_FIELDS).map((field) => [
        field.key,
        field.label,
        EMPLOYEE_IMPORT_SHEETS.filter((item) => item.importable && item.required.includes(field.key))
          .map((item) => item.sheetName)
          .join(" | ") || "—",
        field.description,
      ]),
    ];
  }
  const headerRow = [...sheet.headers];
  const sampleRows = sheet.sampleRows.map((sample) => sheet.headers.map((key) => String(sample[key] ?? "")));
  return [headerRow, ...sampleRows];
}
