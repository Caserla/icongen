export type SignUpFields = {
  email: string;
  password: string;
  passwordConfirmation: string;
  acceptedTerms: boolean;
};
export type SignUpErrors = Partial<Record<keyof SignUpFields, string>>;

export function validateSignUp(
  fields: SignUpFields,
  locale: "en" | "zh" = "en",
): SignUpErrors {
  const errors: SignUpErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    errors.email =
      locale === "zh"
        ? "请输入有效的邮箱地址。"
        : "Enter a valid email address.";
  if (fields.password.length < 8)
    errors.password =
      locale === "zh"
        ? "密码至少需要 8 个字符。"
        : "Use at least 8 characters.";
  if (fields.password !== fields.passwordConfirmation)
    errors.passwordConfirmation =
      locale === "zh"
        ? "两次输入的密码不一致。"
        : "The passwords do not match.";
  if (!fields.acceptedTerms)
    errors.acceptedTerms =
      locale === "zh"
        ? "请同意隐私协议和安全政策后继续。"
        : "Accept the Privacy Policy and Security Policy to continue.";
  return errors;
}
