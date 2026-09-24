/**
 * Sycord Webpack Common
 * Pre-found lazy references to Discord's core modules.
 * Pulled from Vencord's common.tsx + Equicord additions.
 * Everything here is a Proxy — evaluated on first property access.
 */

import {
    findByPropsLazy,
    findByCodeLazy,
    findByDisplayNameLazy,
    findStoreLazy,
} from "./index";

// ── React ─────────────────────────────────────────────────────────────────────
export const React       = findByPropsLazy("createElement", "useEffect", "useState") as typeof import("react");
export const ReactDOM    = findByPropsLazy("render", "createPortal", "findDOMNode");
export const ReactRouter = findByPropsLazy("useHistory", "useLocation", "Redirect");

// ── Flux / Data layer ─────────────────────────────────────────────────────────
export const Flux            = findByPropsLazy("Store", "connectStores");
export const FluxDispatcher  = findByPropsLazy("dispatch", "subscribe", "wait");

// ── Discord Stores ────────────────────────────────────────────────────────────
export const UserStore            = findStoreLazy("UserStore");
export const GuildStore           = findStoreLazy("GuildStore");
export const ChannelStore         = findStoreLazy("ChannelStore");
export const MessageStore         = findStoreLazy("MessageStore");
export const PresenceStore        = findStoreLazy("PresenceStore");
export const RelationshipStore    = findStoreLazy("RelationshipStore");
export const SelectedChannelStore = findStoreLazy("SelectedChannelStore");
export const SelectedGuildStore   = findStoreLazy("SelectedGuildStore");
export const GuildMemberStore     = findStoreLazy("GuildMemberStore");
export const PermissionStore      = findStoreLazy("PermissionStore");
export const EmojiStore           = findStoreLazy("EmojiStore");
export const ReadStateStore       = findStoreLazy("ReadStateStore");
export const VoiceStateStore      = findStoreLazy("VoiceStateStore");
export const ExperimentStore      = findStoreLazy("ExperimentStore");

// ── UI Components ─────────────────────────────────────────────────────────────
export const Button        = findByPropsLazy("BorderColors", "Colors", "Hovers");
export const Text          = findByDisplayNameLazy("LegacyText");
export const Forms         = findByPropsLazy("FormSection", "FormText", "FormTitle");
export const Tooltip       = findByDisplayNameLazy("Tooltip");
export const Modal         = findByPropsLazy("ModalRoot", "ModalHeader", "ModalFooter");
export const Menu          = findByPropsLazy("MenuGroup", "MenuItem", "MenuSeparator");
export const Popout        = findByPropsLazy("Popout");
export const Select        = findByDisplayNameLazy("Select");
export const Slider        = findByDisplayNameLazy("Slider");
export const Switch        = findByDisplayNameLazy("Switch");
export const TextInput     = findByDisplayNameLazy("TextInput");
export const TextArea      = findByDisplayNameLazy("TextArea");
export const SearchBar     = findByDisplayNameLazy("SearchBar");
export const Clickable     = findByDisplayNameLazy("Clickable");
export const TabBar        = findByDisplayNameLazy("TabBar");
export const Card          = findByPropsLazy("CardTypes");
export const Scroller      = findByDisplayNameLazy("AdvancedScroller");
export const ScrollerAuto  = findByDisplayNameLazy("AutoSizer");

// ── Icons (Discord's built-in icon set) ──────────────────────────────────────
export const Icons = findByPropsLazy("getIcon", "CheckmarkSmallIcon");

// ── Utilities ─────────────────────────────────────────────────────────────────
export const RestAPI       = findByPropsLazy("get", "post", "put", "patch", "del");
export const Clipboard     = findByPropsLazy("copy", "SUPPORTS_COPY");
export const Navigation    = findByPropsLazy("transitionTo", "replaceWith", "getHistory");
export const i18n          = findByPropsLazy("Messages", "getLanguages");
export const Parser        = findByPropsLazy("parse", "parseTopic", "parseEmbedTitle");
export const Timestamp     = findByCodeLazy("([0-9]{17,19})");
export const Constants     = findByPropsLazy("Endpoints", "Permissions", "ChannelTypes");
export const PermUtils     = findByPropsLazy("computePermissions", "can");
export const InviteActions = findByPropsLazy("acceptInvite", "resolveInvite");
export const MFA           = findByPropsLazy("showModal", "sendSMS");
export const Notices       = findByPropsLazy("notice", "NoticeTypes");
export const Alerts        = findByPropsLazy("show", "close", "AlertTypes");
export const Toasts        = findByPropsLazy("create", "show", "pop", "ToastType");

// ── Emoji / Sticker ───────────────────────────────────────────────────────────
export const EmojiUtils     = findByPropsLazy("getEmojiUnavailableReason", "isEmojiFiltered");
export const StickerUtils   = findByPropsLazy("getStickerById", "getStickerForMessage");
export const NitroUtils     = findByCodeLazy("PREMIUM_GUILD_SUBSCRIPTION");

// ── Message ───────────────────────────────────────────────────────────────────
export const MessageActions  = findByPropsLazy("sendMessage", "editMessage", "deleteMessage");
export const MessageUtils    = findByPropsLazy("createMessage", "getMessage");
export const UploadManager   = findByPropsLazy("upload", "addFile", "clearAll");

// ── Presence / Status ─────────────────────────────────────────────────────────
export const StatusActions = findByPropsLazy("setStatus", "updateLocalSettings");

// ── Window / OS ───────────────────────────────────────────────────────────────
export const WindowStore = findStoreLazy("WindowStore");
