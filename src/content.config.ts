import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const ctaSchema = z.object({
  label: z.string(),
  href: z.string()
});

const imageSchema = z.object({
  src: z.string(),
  alt: z.string()
});

const sectionHeadingSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string()
});

const formSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  firstNameLabel: z.string(),
  firstNamePlaceholder: z.string(),
  lastNameLabel: z.string(),
  lastNamePlaceholder: z.string(),
  emailLabel: z.string(),
  emailPlaceholder: z.string(),
  phoneLabel: z.string(),
  phonePlaceholder: z.string(),
  serviceLabel: z.string(),
  servicePlaceholder: z.string(),
  serviceOptions: z.array(z.string()),
  quantityLabel: z.string(),
  quantityPlaceholder: z.string(),
  messageLabel: z.string(),
  messagePlaceholder: z.string(),
  privacyNote: z.string(),
  submitLabel: z.string(),
  successTitle: z.string(),
  successMessage: z.string(),
  errorMessage: z.string(),
  emailSubject: z.string()
});

/** Zentrale Unternehmensdaten: src/content/site.json */
const site = defineCollection({
  loader: glob({ pattern: 'site.json', base: './src/content' }),
  schema: z.object({
    name: z.string(),
    legalName: z.string(),
    owner: z.string(),
    legalForm: z.string(),
    slogan: z.string(),
    description: z.string(),
    vatId: z.string(),
    url: z.string().url(),
    email: z.string().email(),
    logo: z.string(),
    phone: z.object({
      display: z.string(),
      href: z.string(),
      raw: z.string()
    }),
    address: z.object({
      street: z.string(),
      zip: z.string(),
      city: z.string(),
      region: z.string(),
      country: z.string(),
      countryName: z.string(),
      geo: z.object({
        lat: z.number(),
        lng: z.number()
      })
    }),
    openingHours: z.array(
      z.object({
        days: z.string(),
        hours: z.string()
      })
    ),
    openingHoursSchema: z.array(z.string()),
    services: z.array(z.string()),
    areaServed: z.string(),
    social: z.array(
      z.object({
        label: z.string(),
        url: z.string().url()
      })
    ),
    navigation: z.object({
      items: z.array(ctaSchema),
      ctaLabel: z.string(),
      ctaHref: z.string(),
      menuOpenLabel: z.string(),
      menuCloseLabel: z.string()
    }),
    footer: z.object({
      servicesTitle: z.string(),
      contactTitle: z.string(),
      legalTitle: z.string(),
      legalLinks: z.array(ctaSchema),
      copyrightNote: z.string(),
      madeIn: z.string()
    }),
    ui: z.object({
      skipLink: z.string(),
      cookieBanner: z.object({
        title: z.string(),
        text: z.string(),
        essentialLabel: z.string(),
        acceptAllLabel: z.string(),
        privacyLinkLabel: z.string()
      })
    })
  })
});

const indexPageSchema = z.object({
  page: z.literal('index'),
  meta: z.object({
    title: z.string(),
    description: z.string()
  }),
  hero: z.object({
    eyebrow: z.string(),
    title: z.string(),
    subtitle: z.string(),
    usps: z.array(z.string()),
    primaryCta: ctaSchema,
    secondaryCta: ctaSchema,
    image: imageSchema,
    badge: z.object({
      title: z.string(),
      text: z.string()
    })
  }),
  stats: z.object({
    items: z.array(
      z.object({
        value: z.string(),
        suffix: z.string(),
        label: z.string(),
        description: z.string()
      })
    )
  }),
  services: sectionHeadingSchema.extend({
    items: z.array(
      z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string(),
        benefits: z.array(z.string()),
        image: imageSchema,
        linkLabel: z.string(),
        linkHref: z.string()
      })
    )
  }),
  partner: z.object({
    eyebrow: z.string(),
    title: z.string(),
    text: z.string(),
    logo: imageSchema,
    linkLabel: z.string(),
    linkHref: z.string()
  }),
  comparison: sectionHeadingSchema.extend({
    columns: z.array(z.string()),
    rows: z.array(
      z.object({
        label: z.string(),
        values: z.array(z.string())
      })
    ),
    note: z.string()
  }),
  process: sectionHeadingSchema.extend({
    steps: z.array(
      z.object({
        title: z.string(),
        text: z.string()
      })
    )
  }),
  showcase: sectionHeadingSchema.extend({
    items: z.array(
      z.object({
        title: z.string(),
        category: z.string(),
        image: imageSchema
      })
    )
  }),
  testimonials: sectionHeadingSchema.extend({
    items: z.array(
      z.object({
        quote: z.string(),
        author: z.string(),
        role: z.string(),
        company: z.string(),
        rating: z.number().min(1).max(5)
      })
    )
  }),
  faq: sectionHeadingSchema.extend({
    items: z.array(
      z.object({
        question: z.string(),
        answer: z.string()
      })
    )
  }),
  cta: z.object({
    title: z.string(),
    text: z.string(),
    primaryCta: ctaSchema,
    note: z.string()
  }),
  contact: sectionHeadingSchema.extend({
    info: z.object({
      title: z.string(),
      text: z.string(),
      personName: z.string(),
      personRole: z.string(),
      addressLabel: z.string(),
      phoneLabel: z.string(),
      emailLabel: z.string(),
      hoursLabel: z.string(),
      hoursNote: z.string()
    }),
    anfahrt: z.object({
      title: z.string(),
      text: z.string()
    })
  }),
  form: formSchema
});

const impressumPageSchema = z.object({
  page: z.literal('impressum'),
  meta: z.object({
    title: z.string(),
    description: z.string()
  }),
  header: z.object({
    title: z.string(),
    subtitle: z.string()
  }),
  companySection: z.object({
    title: z.string(),
    vatLabel: z.string(),
    responsibleTitle: z.string(),
    phoneLabel: z.string(),
    emailLabel: z.string()
  }),
  sections: z.array(
    z.object({
      title: z.string(),
      paragraphs: z.array(z.string())
    })
  )
});

const datenschutzPageSchema = z.object({
  page: z.literal('datenschutz'),
  meta: z.object({
    title: z.string(),
    description: z.string()
  }),
  header: z.object({
    title: z.string(),
    subtitle: z.string()
  }),
  controllerSection: z.object({
    title: z.string(),
    text: z.string(),
    phoneLabel: z.string(),
    emailLabel: z.string()
  }),
  sections: z.array(
    z.object({
      title: z.string(),
      paragraphs: z.array(z.string()),
      list: z.array(z.string()).optional()
    })
  )
});

/** Seiteninhalte: src/content/pages/*.json */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/pages' }),
  schema: z.discriminatedUnion('page', [
    indexPageSchema,
    impressumPageSchema,
    datenschutzPageSchema
  ])
});

export const collections = { site, pages };
