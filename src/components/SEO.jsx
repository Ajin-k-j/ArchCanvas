import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'ArchCanvas';
const DEFAULT_DESCRIPTION = 'Design, share, and collaborate on system architecture diagrams instantly. ArchCanvas is a free, intuitive diagramming tool for developers and architects.';
const DEFAULT_IMAGE = '/logo.png';
const SITE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://archcanvas.com';

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  isDesign = false,
}) {
  const fullTitle = title
    ? `${title} — ArchCanvas`
    : 'ArchCanvas — Visual System Architecture Tool';

  const canonicalUrl = url || (typeof window !== 'undefined' ? window.location.href : SITE_URL);
  const absoluteImage = image.startsWith('http') ? image : `${SITE_URL}${image}`;

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={isDesign ? 'article' : 'website'} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={canonicalUrl} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />
    </Helmet>
  );
}
