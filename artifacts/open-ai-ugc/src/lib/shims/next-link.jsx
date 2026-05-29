import { Link as WouterLink } from "wouter";

/**
 * Drop-in replacement for next/link backed by wouter.
 * Forwards className, onClick, and other anchor props.
 */
export default function Link({ href, children, ...props }) {
  return (
    <WouterLink href={typeof href === "string" ? href : "/"} {...props}>
      {children}
    </WouterLink>
  );
}
