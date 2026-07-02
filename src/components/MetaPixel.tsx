import Script from "next/script";

// Meta Pixel base loader for the member app. Env-gated: with no
// NEXT_PUBLIC_META_PIXEL_ID set it renders nothing, so this is safe to ship
// before the ID is in Vercel. Fires PageView on load; the conversion events
// (CompleteRegistration / StartTrial / Purchase) are sent server-side via CAPI,
// not from here.
const META_PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function MetaPixel() {
  if (!META_PIXEL) return null;
  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL}');fbq('track','PageView');`,
      }}
    />
  );
}
