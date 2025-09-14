"use client";

import { useEffect } from 'react';

export default function VscDomainSetter() {
  useEffect(() => {
    try {
      // Prefer a public env var if provided (same at build time), otherwise use runtime host
      let domain = '';
      if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_VSC_DOMAIN) {
        domain = String(process.env.NEXT_PUBLIC_VSC_DOMAIN);
      } else if (typeof window !== 'undefined') {
        domain = window.location.hostname || '';
      }

      // sanitize quotes if present
      domain = domain.replace(/^\"|\"$/g, '');

      document.documentElement.style.setProperty('--vsc-domain', domain);
    } catch (e) {
      // ignore in environments where document is not available
    }
  }, []);

  return null;
}
