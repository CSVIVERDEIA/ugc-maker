"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { FaUser, FaSignOutAlt, FaChevronDown, FaBars, FaTimes } from "react-icons/fa";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginButton } from "./AuthButtons";
import logoUrl from "@assets/VIA_app_icon_1780089502703.png";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Gerador", href: "/" },
    { name: "Produtos", href: "/products" },
    { name: "Avatares", href: "/avatars" },
    { name: "Campanhas", href: "/campaigns" },
    { name: "Minhas Criações", href: "/dashboard" },
    { name: "Configurações", href: "/settings" },
  ];

  return (
    <nav className="h-20 flex-shrink-0 border-b border-glass-border bg-glass-bg backdrop-blur-3xl sticky top-0 z-[100] px-4 md:px-12 flex items-center justify-between">
      {/* Logo Section */}
      <Link href="/" className="flex items-center gap-3 group">
        <img
          src={logoUrl}
          alt="VIA"
          className="w-10 h-10 rounded-xl shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform"
        />
        <div className="flex flex-col leading-none">
          <span className="font-black text-xl tracking-tighter uppercase text-foreground">
            Open AI UGC
          </span>
        </div>
      </Link>

      {/* Navigation Links */}
      <div className="hidden md:flex items-center gap-8">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          if (!session && link.href !== "/") return null;

          return (
            <Link
              key={link.name}
              href={link.href}
              className={`text-sm font-semibold tracking-tight transition-all relative py-2 ${
                isActive ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {link.name}
              {isActive && (
                <motion.div
                  layoutId="nav-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        {session ? (
          <>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 p-1 rounded hover:bg-glass-bg transition-all outline-none"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt="Avatar"
                    className="w-8 h-8 rounded ring-2 ring-white/5 shadow-lg"
                  />
                ) : (
                  <div className="w-8 h-8 rounded ring-2 ring-white/5 shadow-lg bg-primary-500 flex items-center justify-center text-white text-xs font-bold uppercase">
                    {(session.user.name || session.user.email || "U").charAt(0)}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-4 w-56 bg-glass-bg border border-glass-border rounded shadow-2xl p-2 z-[200] backdrop-blur-3xl"
                  >
                    <div className="flex flex-col gap-1 p-3 border-b border-glass-border">
                      <h3 className="text-xs font-bold text-foreground truncate">{session.user.name}</h3>
                      <div className="text-[10px] font-medium text-muted truncate">{session.user.email}</div>
                    </div>
                    
                    <Link
                      href="/dashboard"
                      className="w-full flex items-center gap-3 p-3 rounded hover:bg-glass-hover text-foreground transition-all font-semibold text-xs"
                    >
                      <FaUser className="text-muted" /> My Dashboard
                    </Link>

                    <button
                      onClick={() => signOut()}
                      className="w-full flex items-center justify-between p-3 rounded hover:bg-red-500/10 text-muted hover:text-red-500 transition-all font-semibold text-xs group"
                    >
                      Sign Out
                      <FaSignOutAlt className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <LoginButton className="!h-10 !px-6 !text-[10px] !tracking-widest !font-bold" />
        )}
        
        <button 
          className="md:hidden p-2 text-muted hover:text-foreground"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <FaTimes className="text-xl" /> : <FaBars className="text-xl" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full left-0 right-0 bg-glass-bg border-b border-glass-border backdrop-blur-3xl md:hidden overflow-hidden z-[90]"
          >
            <div className="flex flex-col p-6 gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-bold text-foreground uppercase tracking-widest"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
