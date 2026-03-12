/**
 * Single source of truth for domain constants used across pages and components.
 * Keep types in types/index.ts; keep values here.
 */

// ── Roles ─────────────────────────────────────────────────────────────────────

export const RoleConst = {
    super_admin: "super_admin",
    tutor: "tutor",
    finance: "finance",
    org_admin: "org_admin",
    teacher: "teacher",
    student: "student",

    // Role groups - typed properly
    internal: ["super_admin", "tutor", "finance"] as const,
    creator: ["super_admin", "tutor", "org_admin", "teacher"] as const,
    manager: ["super_admin", "org_admin", "teacher"] as const,
    admin: ["super_admin", "org_admin"] as const,
    global_scope: ["super_admin", "tutor"] as const,
    all: [
        "super_admin",
        "tutor",
        "finance",
        "org_admin",
        "teacher",
        "student",
    ] as const,
    org_roles: ["org_admin", "teacher", "student"] as const,

    values() {
        return [
            "super_admin",
            "tutor",
            "finance",
            "org_admin",
            "teacher",
            "student",
        ];
    },

    to_dict() {
        return {
            super_admin: "Super Admin",
            tutor: "Tutor",
            finance: "Finance",
            org_admin: "Org Admin",
            teacher: "Teacher",
            student: "Student",
        };
    },
};

// Alias for convenience
export const Role = RoleConst;

// ── Role styling ──────────────────────────────────────────────────────────────

export const RoleStyle = {
    avatar_bg: {
        super_admin: "linear-gradient(135deg,#F97316,#EA580C)",
        tutor: "linear-gradient(135deg,#F97316,#FACC15)",
        finance: "linear-gradient(135deg,#FACC15,#F97316)",
        org_admin: "linear-gradient(135deg,#EA580C,#C2410C)",
        teacher: "linear-gradient(135deg,#22C55E,#F97316)",
        student: "linear-gradient(135deg,#F97316,#FBBF24)",
    },

    chip: {
        super_admin: { bg: "#FEE2E2", color: "#991B1B" },
        tutor: { bg: "#FFEDD5", color: "#C2410C" },
        finance: { bg: "#FEF3C7", color: "#92400E" },
        org_admin: { bg: "#EDE9FE", color: "#5B21B6" },
        teacher: { bg: "#D1FAE5", color: "#065F46" },
        student: { bg: "#F1F5F9", color: "#475569" },
    },
};

// ── Content ───────────────────────────────────────────────────────────────────

export const ContentEmojiConst = {
    text: "📄",
    video: "🎬",
    audio: "🎧",
    pdf: "📑",
    assessment: "📝",

    values() {
        return ["📄", "🎬", "🎧", "📑", "📝"];
    },

    to_dict() {
        return {
            text: "📄",
            video: "🎬",
            audio: "🎧",
            pdf: "📑",
            assessment: "📝",
        };
    },
};

// Alias for convenience
export const ContentEmoji = ContentEmojiConst;

export const ContentTypeConst = {
    text: "text" as const,
    video: "video" as const,
    audio: "audio" as const,
    pdf: "pdf" as const,
    assessment: "assessment" as const,

    values() {
        return ["text", "video", "audio", "pdf", "assessment"];
    },

    to_dict() {
        return {
            text: "Text",
            video: "Video",
            audio: "Audio",
            pdf: "PDF",
            assessment: "Assessment",
        };
    },
};

// Alias for convenience
export const ContentType = ContentTypeConst;

/** Options used in the content-type selector on Create Content. */
export const ContentTypeOptions = [
    { value: "text" as const, icon: "📄", label: "Text" },
    { value: "video" as const, icon: "🎬", label: "Video" },
    { value: "audio" as const, icon: "🎧", label: "Audio" },
    { value: "pdf" as const, icon: "📑", label: "PDF" },
    { value: "assessment" as const, icon: "📝", label: "Assessment" },
];

/** Chip colours for content type badges. */
export const ContentTypeStyle = {
    chip: {
        text:  { bg: "#DBEAFE", color: "#1E40AF" },  // blue-800: 4.83:1 on #DBEAFE
        video: { bg: "#FCE7F3", color: "#BE185D" },
        audio: { bg: "#D1FAE5", color: "#065F46" },
        pdf:   { bg: "#FEF3C7", color: "#92400E" },
        assessment:  { bg: "#EDE9FE", color: "#5B21B6" },
    },
};

/** File accept attributes for the upload input, keyed by content type. */
export const ContentFileAccept: Record<string, string> = {
    video: "video/*",
    audio: "audio/*",
    pdf: "application/pdf",
};

/** Filter buttons shown in the Content Library. */
export const ContentFilters = [
    { value: "all", label: "All", bg: "#F97316", color: "#1C1A17" },  // 6.0:1
    {
        value: "text",
        label: "📄 Text",
        bg: ContentTypeStyle.chip.text.bg,
        color: ContentTypeStyle.chip.text.color,
    },
    {
        value: "video",
        label: "🎬 Video",
        bg: ContentTypeStyle.chip.video.bg,
        color: ContentTypeStyle.chip.video.color,
    },
    {
        value: "audio",
        label: "🎧 Audio",
        bg: ContentTypeStyle.chip.audio.bg,
        color: ContentTypeStyle.chip.audio.color,
    },
    {
        value: "pdf",
        label: "📑 PDF",
        bg: ContentTypeStyle.chip.pdf.bg,
        color: ContentTypeStyle.chip.pdf.color,
    },
    {
        value: "assessment",
        label: "📝 Assessment",
        bg: ContentTypeStyle.chip.assessment.bg,
        color: ContentTypeStyle.chip.assessment.color,
    },
    { value: "global", label: "🌍 Global", bg: "#FEF3C7", color: "#92400E" },
] as const;
