"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
export type Locale = "en" | "zh";
const words: Record<string, Record<Locale, string>> = {
  home: { en: "Home", zh: "首页" },
  pricing: { en: "Pricing", zh: "价格" },
  myIcons: { en: "My Icons", zh: "我的图标" },
  signIn: { en: "Sign in", zh: "登录" },
  createIcons: { en: "Create icons", zh: "创建图标" },
  create: { en: "Create", zh: "创建" },
  account: { en: "Account", zh: "账户" },
  adminConsole: { en: "Admin console", zh: "管理后台" },
  showPassword: { en: "Show password", zh: "显示密码" },
  hidePassword: { en: "Hide password", zh: "隐藏密码" },
  welcomeBack: { en: "Welcome back", zh: "欢迎回来" },
  signInCreate: {
    en: "Sign in to your account",
    zh: "请登录帐号",
  },
  waiting: {
    en: "Sign in to create and manage your icon sets.",
    zh: "登录后创建和管理你的图标。",
  },
  email: { en: "Email address", zh: "邮箱地址" },
  password: { en: "Password", zh: "密码" },
  forgot: { en: "Forgot password?", zh: "忘记密码？" },
  continue: { en: "Sign in", zh: "登录" },
  newHere: { en: "New to EASY ICON?", zh: "第一次使用 EASY ICON？" },
  createAccount: { en: "Create your account", zh: "创建账户" },
  authUnavailable: {
    en: "Sign-in is temporarily unavailable. Please try again later.",
    zh: "登录功能暂不可用，请稍后再试。",
  },
  emailConfirmed: { en: "Email confirmed", zh: "邮箱确认成功" },
  verificationSuccess: {
    en: "Your email is verified.",
    zh: "你的邮箱已验证。",
  },
  verificationSuccessCopy: {
    en: "Your email is verified. You can now open your workspace.",
    zh: "邮箱验证完成，现在可以进入工作空间。",
  },
  redirectingWorkspace: {
    en: "Opening your workspace",
    zh: "正在打开工作空间",
  },
  enterWorkspace: { en: "Open workspace", zh: "打开工作空间" },
  workspace: { en: "Icon Gen", zh: "图标生成" },
  avatarAndProfile: { en: "Personal information", zh: "个人信息" },
  signOut: { en: "Sign out", zh: "退出登录" },
  signingOut: { en: "Signing out…", zh: "正在退出…" },
  defaultAvatar: { en: "Default avatar", zh: "默认头像" },
  defaultAvatarCopy: {
    en: "Your avatar uses the first letter of your display name or email.",
    zh: "当前头像使用显示昵称或邮箱的首字母。",
  },
  studio: { en: "AI icon sets for apps", zh: "为 App 生成成套图标" },
  hero: {
    en: "Create a consistent UI icon set in one workflow.",
    zh: "一次配置，生成一套风格统一的 UI 图标",
  },
  heroCopy: {
    en: "Add each icon you need, set one shared visual direction, and get three options for every icon to compare and download.",
    zh: "逐个添加所需图标，统一设置视觉方向；每个图标生成 3 个方案，方便比较和下载。",
  },
  directions: { en: "3 options per icon.", zh: "每个图标 3 个方案。" },
  brief: {
    en: "One visual direction with downloadable PNG output.",
    zh: "统一视觉方向，输出可下载的 PNG。",
  },
  personal: { en: "", zh: "" },
  yourAccount: { en: "Personal information", zh: "个人信息" },
  accountCopy: {
    en: "Manage your profile and account security.",
    zh: "管理个人资料和账户安全。",
  },
  active: { en: "Active account", zh: "账户正常" },
  generations: { en: "5 icon generations available", zh: "可生成 5 组图标" },
  iconsCreated: { en: "Icons created", zh: "已创建图标" },
  briefs: { en: "Across 8 creative briefs", zh: "来自 8 份创意需求" },
  memberSince: { en: "Member since", zh: "加入时间" },
  verified: { en: "Email verified", zh: "邮箱已验证" },
  profile: { en: "Personal information", zh: "个人信息" },
  profileCopy: { en: "", zh: "" },
  displayName: { en: "Display name", zh: "显示昵称" },
  save: { en: "Save changes", zh: "保存修改" },
  security: { en: "Security", zh: "安全" },
  securityCopy: {
    en: "Your account protection status.",
    zh: "查看你的账户保护状态。",
  },
  lastUpdated: { en: "Last updated 24 days ago", zh: "24 天前更新" },
  saved: { en: "Personal information saved", zh: "个人信息已保存" },
  signingIn: { en: "Signing in…", zh: "正在登录…" },
  continueWithGoogle: { en: "Continue with Google", zh: "Google 登录" },
  continueWithGithub: { en: "Continue with GitHub", zh: "GitHub 登录" },
  socialSignInFailed: {
    en: "Third-party sign-in could not start. Please try again.",
    zh: "无法启动第三方登录，请稍后重试。",
  },
  orContinueWithEmail: { en: "or use email", zh: "或使用邮箱登录" },
  invalidLogin: {
    en: "Please check your email and password.",
    zh: "请检查邮箱和密码。",
  },
  startCreating: { en: "Start creating", zh: "开始创作" },
  createYourAccount: {
    en: "Create your EASY ICON account",
    zh: "创建 EASY ICON 账户",
  },
  confirmPassword: { en: "Confirm password", zh: "确认密码" },
  passwordHint: {
    en: "Use at least 8 characters.",
    zh: "密码至少需要 8 个字符。",
  },
  acceptTerms: {
    en: "I have read and agree to the Privacy Policy and Security Policy.",
    zh: "我已阅读并同意《隐私协议》和《安全政策》。",
  },
  creating: { en: "Creating…", zh: "正在创建…" },
  alreadyAccount: { en: "Already have an account?", zh: "已经有账户？" },
  checkInbox: {
    en: "Check your inbox to verify your email.",
    zh: "请前往邮箱完成验证。",
  },
  signupFailed: {
    en: "We could not create your account. Check the form and try again.",
    zh: "账户创建失败，请检查填写内容后重试。",
  },
  signupDisabled: {
    en: "Registration is not open yet.",
    zh: "当前暂未开放注册。",
  },
  recovery: { en: "Account recovery", zh: "账户找回" },
  resetPassword: { en: "Reset your password", zh: "重置密码" },
  sendReset: { en: "Send reset link", zh: "发送重置链接" },
  resetSent: {
    en: "If an account matches that email, we sent a link that opens the password reset page.",
    zh: "如果该邮箱对应一个账户，我们已发送邮件；点击邮件链接即可进入重置密码页面。",
  },
  backSignIn: { en: "Back to sign in", zh: "返回登录" },
  choosePassword: { en: "Choose a new password", zh: "设置新密码" },
  newPassword: { en: "New password", zh: "新密码" },
  confirmNewPassword: { en: "Confirm new password", zh: "确认新密码" },
  passwordsDoNotMatch: {
    en: "The two passwords do not match.",
    zh: "两次输入的密码不一致。",
  },
  updatePassword: { en: "Update password", zh: "更新密码" },
  passwordUpdated: {
    en: "Password updated. You can now sign in.",
    zh: "密码已更新，现在可以登录。",
  },
  resetInvalid: {
    en: "This reset link is invalid or has expired. Request a new link to continue.",
    zh: "此重置链接无效或已过期，请重新获取链接。",
  },
  sending: { en: "Sending…", zh: "正在发送…" },
  updating: { en: "Updating…", zh: "正在更新…" },
  authRequestFailed: {
    en: "The authentication service is unavailable. Please try again later.",
    zh: "登录服务暂时不可用，请稍后重试。",
  },
  loadingAccount: { en: "Loading account…", zh: "正在加载账户…" },
  loadAccountFailed: {
    en: "Your account details could not load. Refresh the page to try again.",
    zh: "账户信息加载失败，请刷新页面重试。",
  },
  saveProfileFailed: {
    en: "Your profile was not saved. Check your connection and try again.",
    zh: "个人资料未保存，请检查网络后重试。",
  },
  saving: { en: "Saving…", zh: "正在保存…" },
  verificationPending: { en: "Email verification pending", zh: "邮箱待验证" },
  requestFailed: {
    en: "Request failed. Please try again.",
    zh: "操作失败，请重试。",
  },
  generationJob: { en: "Icon set", zh: "图标集" },
  iconSubjects: { en: "icon subjects", zh: "个图标主体" },
  threeEach: { en: "three options each", zh: "每个主体 3 个方案" },
  direction: { en: "Option", zh: "方案" },
  downloadPng: { en: "Download PNG", zh: "下载 PNG" },
  creatingIcons: {
    en: "Your icons are being created.",
    zh: "正在生成你的图标。",
  },
  leaveAndReturn: {
    en: "You can leave this page and return from My Icons.",
    zh: "你可以离开此页面，稍后从“我的图标”返回查看。",
  },
  operations: { en: "Operations", zh: "运营" },
  adminWorkspace: { en: "Admin workspace", zh: "管理工作台" },
  adminCopy: {
    en: "Review users, projects, and icon generation.",
    zh: "查看用户、项目和图标生成。",
  },
  adminComing: {
    en: "This section is not available yet.",
    zh: "此模块暂未开放。",
  },
};
type Value = {
  locale: Locale;
  setLocale: (v: Locale) => void;
  t: (key: string) => string;
};
const Context = createContext<Value | null>(null);
function subscribe(callback: () => void) {
  window.addEventListener("icongen-locale", callback);
  return () => window.removeEventListener("icongen-locale", callback);
}
function getLocale(): Locale {
  return localStorage.getItem("icongen-locale") === "zh" ? "zh" : "en";
}
function getServerLocale(): Locale {
  return "en";
}
export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(
    subscribe,
    getLocale,
    getServerLocale,
  );
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);
  const setLocale = (v: Locale) => {
    localStorage.setItem("icongen-locale", v);
    window.dispatchEvent(new Event("icongen-locale"));
  };
  const value = useMemo<Value>(
    () => ({ locale, setLocale, t: (k: string) => words[k]?.[locale] ?? k }),
    [locale],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLocale() {
  const value = useContext(Context);
  if (!value) throw new Error("LocaleProvider missing");
  return value;
}
