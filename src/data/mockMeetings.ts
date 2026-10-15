import { Meeting } from "../types";

export const DEFAULT_MEETINGS: Meeting[] = [
  {
    id: "meet-weekly-sync",
    title: "Weekly team sync",
    date: "Today, 10:30 AM",
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    participantsCount: 8,
    duration: "32m",
    topicsCovered: ["Q3 Roadmap", "Mobile App", "API Improvements", "User Research", "Design System"],
    summary: "The team discussed Q3 product roadmap priorities, focusing on the tradeoff between mobile app development and API improvements. Emily presented user research showing 68% of users access the product on mobile.",
    actionItems: [
      { assignee: "Emily", task: "Share full user research report on mobile usage with Marcus.", completed: false },
      { assignee: "Marcus", task: "Audit latency of API endpoints used by mobile client.", completed: false },
      { assignee: "Alex", task: "Draft initial resource allocation proposal for split team.", completed: false },
      { assignee: "Sarah Chen", task: "Schedule follow-up sync to finalize roadmap timeline.", completed: false }
    ],
    decisions: [
      "Focus on optimizing core mobile screens first while maintaining a single backend engineer for API latency optimizations.",
      "Utilize a hybrid development resource split to de-risk mobile churn."
    ],
    transcript: [
      { id: "1", speaker: "Sarah Chen", text: "Alright team, let's dive into our Q3 roadmap priorities. We need to decide where to focus our engineering resources: mobile app development or back-end API improvements.", timestamp: "10:30 AM" },
      { id: "2", speaker: "Marcus", text: "I think improving the API is critical. We've had several customer complaints about API latency during peak hours.", timestamp: "10:31 AM" },
      { id: "3", speaker: "Emily", text: "While I agree the API needs work, our user research shows that 68% of our active users are now accessing the product via mobile. A buggy or outdated mobile experience is a major churn risk.", timestamp: "10:32 AM" },
      { id: "4", speaker: "Sarah Chen", text: "...and I think the new design approach will really help us move faster on product iterations.", timestamp: "10:33 AM" },
      { id: "5", speaker: "Alex", text: "Can we find a compromise? Maybe we focus on the core mobile screens first, while dedicating one engineer to optimize the slowest API endpoints?", timestamp: "10:35 AM" },
      { id: "6", speaker: "Tom", text: "That sounds reasonable. If we optimize the endpoints used specifically by the mobile client, we hit both goals.", timestamp: "10:36 AM" },
      { id: "7", speaker: "Sarah Chen", text: "Excellent idea. Let's draft a plan for that. Emily, can you share the full mobile research report with Marcus so we can map out which API endpoints are critical for mobile performance?", timestamp: "10:38 AM" },
      { id: "8", speaker: "Emily", text: "Yes, I'll send that over right after this meeting.", timestamp: "10:39 AM" },
      { id: "9", speaker: "Marcus", text: "Perfect, once I have that, I'll list out the specific backend optimizations needed and we can divide the work.", timestamp: "10:41 AM" },
      { id: "10", speaker: "Sarah Chen", text: "Sounds like a plan. Let's do it.", timestamp: "10:42 AM" }
    ]
  },
  {
    id: "meet-product-review",
    title: "Product review",
    date: "Yesterday, 2:00 PM",
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    participantsCount: 5,
    duration: "45m",
    topicsCovered: ["Onboarding Flow", "User Drop-off", "Security Page", "Signup Conversion"],
    summary: "Reviewed conversion metrics for the new signup onboarding flow. Overall conversions are up 15%, but we identified a significant drop-off on the second security/password complexity page.",
    actionItems: [
      { assignee: "Marcus", task: "Simplify password requirement validation error messaging.", completed: true },
      { assignee: "Sarah", task: "Redesign the layout of the security setup screen to make it less intimidating.", completed: false },
      { assignee: "Nina", task: "Set up Mixpanel event tracking for each field on the password page.", completed: false }
    ],
    decisions: [
      "Relax the password length requirement from 12 characters to 8, but enforce checking against common pwned databases.",
      "Merge the security page with the general user details step to reduce total steps."
    ],
    transcript: [
      { id: "1", speaker: "Sarah Chen", text: "Hi everyone, let's look at the results of the new onboarding flow we rolled out last week.", timestamp: "2:00 PM" },
      { id: "2", speaker: "Marcus", text: "The good news is that total conversions are up by 15% overall. The step-by-step layout is working much better than the single long form.", timestamp: "2:02 PM" },
      { id: "3", speaker: "Nina", text: "However, the funnels show a massive 30% drop-off on page 2—the password and security configuration screen.", timestamp: "2:05 PM" },
      { id: "4", speaker: "James", text: "Is it because our password requirements are too strict? We require 12 characters, numbers, symbols, and no repeating patterns.", timestamp: "2:08 PM" },
      { id: "5", speaker: "Sarah Chen", text: "Exactly, it feels very intimidating. Some users are probably leaving because they can't think of a compliant password quickly.", timestamp: "2:12 PM" },
      { id: "6", speaker: "Marcus", text: "Let's change it to a minimum of 8 characters, and we can check it server-side against leaked databases rather than nagging them in the UI with complex regex rules.", timestamp: "2:18 PM" },
      { id: "7", speaker: "Nina", text: "Agreed. I will also add granular analytics to track exactly where people click on that screen.", timestamp: "2:25 PM" }
    ]
  },
  {
    id: "meet-design-sprint",
    title: "Design sprint",
    date: "Mon, 9:00 AM",
    createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    participantsCount: 12,
    duration: "1h 15m",
    topicsCovered: ["Landing Page", "Brand Refresh", "Teal Accents", "Figma Prototyping"],
    summary: "Aligned on the direction for the landing page redesign. The team chose the dark minimalist aesthetic with deep teal accent colors, prioritizing content-focused sections and elegant typography.",
    actionItems: [
      { assignee: "Sarah", task: "Build high-fidelity Figma prototypes for the selected homepage layout.", completed: true },
      { assignee: "Alex", task: "Write initial copywriting drafts for the hero and features sections.", completed: false },
      { assignee: "Tom", task: "Conduct a technical feasibility review of the proposed SVG layouts.", completed: false }
    ],
    decisions: [
      "Approved the modern dark visual theme with deep teal accents over the light grey alternative.",
      "Agreed to use Space Grotesk for landing page headings and Inter for body text."
    ],
    transcript: [
      { id: "1", speaker: "Sarah Chen", text: "Welcome to the final review of the design sprint. We have two options: the Light Editorial theme, or the Dark Minimalist theme.", timestamp: "9:00 AM" },
      { id: "2", speaker: "Alex", text: "The Dark Minimalist direction has a very premium and technical vibe. It fits our audience of developers and builders perfectly.", timestamp: "9:10 AM" },
      { id: "3", speaker: "Lisa", text: "The deep teal accent colors in the dark mockup look gorgeous and draw attention directly to the call-to-actions.", timestamp: "9:20 AM" },
      { id: "4", speaker: "Tom", text: "Are we worried about contrast or readability in the dark version?", timestamp: "9:35 AM" },
      { id: "5", speaker: "Sarah Chen", text: "We checked contrast scores. They all pass WCAG AAA standards easily since we're using bright cyan/teal on deep charcoal, not pure black.", timestamp: "9:45 AM" },
      { id: "6", speaker: "Alex", text: "Awesome. Let's go with the Dark Minimalist look. I'll get started on the copywriting drafts to fit that layout.", timestamp: "10:00 AM" }
    ]
  }
];
