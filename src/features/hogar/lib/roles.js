/** Cuenta con acceso de superadmin aunque su perfil todavía no tenga el rol. */
export const EMAIL_SUPERADMIN = "edisonmedina415@gmail.com";

export const esSuperadmin = (perfil, session) =>
  perfil?.rol === "superadmin" || session?.user?.email === EMAIL_SUPERADMIN;
