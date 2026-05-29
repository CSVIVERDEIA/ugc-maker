// Sinaliza pra Home abrir o wizard de configuração inicial.
// Usado no primeiro cadastro e no botão "Reiniciar onboarding" das configurações.

const KEY = "ugc:openOnboarding";

export function triggerOnboarding() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {}
}

export function consumeOnboardingTrigger() {
  try {
    if (sessionStorage.getItem(KEY) === "1") {
      sessionStorage.removeItem(KEY);
      return true;
    }
  } catch {}
  return false;
}
