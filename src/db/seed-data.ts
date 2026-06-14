/**
 * Static seed dataset for the Google Cloud Professional Cloud Architect (PCA)
 * content library.
 *
 * Authored from the structure of the official PCA Exam Guide and Google Cloud
 * Architecture / Well-Architected Framework documentation. These are realistic
 * hand-written excerpts — NO live PDF fetching or scraping is performed (a
 * deliberate demo decision; see README). IDs are stable so URLs and provenance
 * stay consistent across re-seeds.
 *
 * Reference structure:
 *   - PCA Exam Guide: services.google.com/.../professional_cloud_architect_exam_guide_english.pdf
 *   - GCP Architecture: cloud.google.com/architecture
 */
import type { ChangeType, ContentType, SourceKind } from "./schema";
import type { LessonBody, QuestionBody } from "@/lib/content-types";

export interface SeedTopic {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string;
}

export interface SeedSource {
  id: string;
  name: string;
  kind: SourceKind;
  /** Initial (v1) version of the source. */
  version: {
    id: string;
    title: string;
    body: string;
  };
}

export interface SeedContentItem {
  id: string;
  type: ContentType;
  title: string;
  topicSlugs: string[];
  /** source_version ids that grounded the original content (provenance). */
  sourceVersionIds: string[];
  body: QuestionBody | LessonBody;
}

/**
 * A simulated Google Cloud Next change: the v2 body of an existing source plus
 * the change events a detector would emit. Consumed by /api/simulate/gcp-next.
 */
export interface SeedSourceChange {
  sourceId: string;
  newVersion: { id: string; title: string; body: string };
  changes: Array<{
    changeType: ChangeType;
    summary: string;
    detail: string;
    severity: number;
    affectedTopics: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Knowledge graph
// ---------------------------------------------------------------------------

export const SEED_TOPICS: SeedTopic[] = [
  // Domain 1
  {
    id: "t_design",
    parentId: null,
    name: "Designing Cloud Solution Architecture",
    slug: "design-architecture",
    description:
      "Translating business and technical requirements into a Google Cloud architecture across compute, storage, and networking.",
  },
  {
    id: "t_compute_design",
    parentId: "t_design",
    name: "Compute System Design",
    slug: "compute-design",
    description:
      "Choosing between Compute Engine, Google Kubernetes Engine, Cloud Run, and Cloud Functions based on workload characteristics.",
  },
  {
    id: "t_storage_design",
    parentId: "t_design",
    name: "Storage System Design",
    slug: "storage-design",
    description:
      "Selecting Cloud Storage classes, databases (Cloud SQL, Spanner, Firestore, Bigtable), and data warehousing for the access pattern.",
  },
  {
    id: "t_network_design",
    parentId: "t_design",
    name: "Network Design",
    slug: "network-design",
    description:
      "VPC topology, hybrid connectivity, and load balancing choices for availability, latency, and security.",
  },
  // Domain 2
  {
    id: "t_infra",
    parentId: null,
    name: "Managing & Provisioning Infrastructure",
    slug: "manage-infrastructure",
    description:
      "Provisioning and operating compute, storage, and network resources, including infrastructure automation.",
  },
  {
    id: "t_iac",
    parentId: "t_infra",
    name: "Infrastructure as Code",
    slug: "infrastructure-as-code",
    description:
      "Declarative provisioning of Google Cloud resources for repeatable, version-controlled deployments.",
  },
  {
    id: "t_compute_provision",
    parentId: "t_infra",
    name: "Compute Provisioning",
    slug: "compute-provisioning",
    description:
      "Managed instance groups, autoscaling, and instance templates for scalable compute fleets.",
  },
  // Domain 3
  {
    id: "t_security",
    parentId: null,
    name: "Security & Compliance",
    slug: "security-compliance",
    description:
      "Designing for least privilege, data protection, and regulatory compliance across the stack.",
  },
  {
    id: "t_iam",
    parentId: "t_security",
    name: "Identity & Access Management",
    slug: "iam",
    description:
      "IAM roles, service accounts, and the principle of least privilege on Google Cloud.",
  },
  {
    id: "t_data_security",
    parentId: "t_security",
    name: "Data Security & Encryption",
    slug: "data-security",
    description:
      "Encryption at rest and in transit, customer-managed encryption keys (CMEK), and Cloud KMS.",
  },
  // Domain 4
  {
    id: "t_optimize",
    parentId: null,
    name: "Optimizing Processes",
    slug: "optimize-processes",
    description:
      "Analyzing and optimizing technical and business processes for cost and efficiency.",
  },
  {
    id: "t_cost",
    parentId: "t_optimize",
    name: "Cost Optimization",
    slug: "cost-optimization",
    description:
      "Committed use discounts, rightsizing, and Active Assist recommendations to control spend.",
  },
  // Domain 5
  {
    id: "t_reliability",
    parentId: null,
    name: "Reliability & Operations",
    slug: "reliability-operations",
    description:
      "Ensuring solution and operations reliability through SRE practices, monitoring, and disaster recovery.",
  },
  {
    id: "t_sre",
    parentId: "t_reliability",
    name: "SRE & Monitoring",
    slug: "sre-monitoring",
    description:
      "Service level indicators/objectives, error budgets, and Cloud Monitoring/Logging.",
  },
  {
    id: "t_dr",
    parentId: "t_reliability",
    name: "Disaster Recovery",
    slug: "disaster-recovery",
    description:
      "RPO/RTO-driven backup, warm standby, and multi-region recovery strategies.",
  },
  // Cross-cutting
  {
    id: "t_waf",
    parentId: null,
    name: "Well-Architected Framework",
    slug: "well-architected-framework",
    description:
      "Google Cloud's architectural best practices across operational excellence, security, reliability, cost, and performance.",
  },
  {
    id: "t_genai",
    parentId: null,
    name: "Generative AI on Google Cloud",
    slug: "generative-ai",
    description:
      "Designing solutions with Vertex AI, Gemini models, grounding, and retrieval-augmented generation.",
  },
];

// ---------------------------------------------------------------------------
// Sources (v1)
// ---------------------------------------------------------------------------

export const SEED_SOURCES: SeedSource[] = [
  {
    id: "src_exam_guide",
    name: "PCA Exam Guide",
    kind: "exam_guide",
    version: {
      id: "sv_exam_guide_v1",
      title: "Professional Cloud Architect Exam Guide (Rev. 2023)",
      body: `Section 2: Managing and provisioning a solution infrastructure
2.1 Configuring network topologies. Considerations include VPC design, hybrid connectivity (Cloud VPN, Cloud Interconnect), and load balancing.
2.2 Configuring individual storage systems. Considerations include data storage allocation, processing/compute capacity, and Cloud Storage class selection.
2.3 Configuring compute systems. Considerations include managed instance groups, autoscaling policies, and infrastructure provisioning using Deployment Manager templates for repeatable, declarative deployments.

Section 4: Analyzing and optimizing technical and business processes
4.1 Cost optimization. Considerations include committed use discounts, rightsizing, and Active Assist recommendations.

Section 5: Ensuring solution and operations reliability
5.1 Monitoring/logging/profiling/alerting. Designing service level objectives (SLOs) and error budgets.
5.2 Disaster recovery planning driven by recovery point objective (RPO) and recovery time objective (RTO).`,
    },
  },
  {
    id: "src_arch_docs",
    name: "GCP Architecture Documentation",
    kind: "best_practices",
    version: {
      id: "sv_arch_docs_v1",
      title: "Google Cloud Architecture Framework (2023)",
      body: `Infrastructure as code. Use Google Cloud Deployment Manager to define your infrastructure declaratively in YAML, Python, or Jinja2 templates. Deployment Manager lets you treat configuration as code and repeatably create resources.

Reliability pillar. Build redundancy, define SLOs, and plan disaster recovery based on RPO and RTO targets.

Cost optimization pillar. Apply committed use discounts and review Active Assist recommendations.

Generative AI. Vertex AI provides access to foundation models. Use Vertex AI to build and tune models for prediction workloads.`,
    },
  },
];

// ---------------------------------------------------------------------------
// Content library (12-16 items)
// ---------------------------------------------------------------------------

export const SEED_CONTENT: SeedContentItem[] = [
  // ---- Questions ----------------------------------------------------------
  {
    id: "ci_q_iac_dm",
    type: "question",
    title: "Choosing an infrastructure-as-code tool for repeatable deployments",
    topicSlugs: ["infrastructure-as-code", "manage-infrastructure"],
    sourceVersionIds: ["sv_exam_guide_v1", "sv_arch_docs_v1"],
    body: {
      stem: "Your team needs a Google Cloud-native, declarative way to provision and repeatably manage VPCs, instances, and firewall rules as version-controlled configuration. Which managed service should you recommend?",
      options: [
        "Google Cloud Deployment Manager",
        "A custom Bash script invoking gcloud commands",
        "Manually creating resources in the Cloud Console",
        "Cloud Scheduler triggering Cloud Functions",
      ],
      answerIndex: 0,
      rationale:
        "Google Cloud Deployment Manager is the Google-native infrastructure-as-code service. It lets you declare resources in YAML/Python/Jinja2 templates and create them repeatably, treating configuration as version-controlled code. Imperative scripts and manual Console steps are not declarative or repeatable.",
    },
  },
  {
    id: "ci_q_storage_class",
    type: "question",
    title: "Selecting a Cloud Storage class for long-term archival",
    topicSlugs: ["storage-design"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      stem: "You must retain compliance data that is accessed at most once a year and must be stored at the lowest possible cost. Which Cloud Storage class is most appropriate?",
      options: ["Archive", "Standard", "Nearline", "Coldline"],
      answerIndex: 0,
      rationale:
        "Archive Storage offers the lowest at-rest price and is designed for data accessed less than once a year, making it ideal for long-term compliance archives. Coldline targets quarterly access, Nearline monthly, and Standard frequent access.",
    },
  },
  {
    id: "ci_q_lb",
    type: "question",
    title: "Load balancing for a global web application",
    topicSlugs: ["network-design"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      stem: "A web application serves users worldwide over HTTPS and needs a single anycast IP, global routing to the closest healthy backend, and TLS termination. Which load balancer should you choose?",
      options: [
        "Global external Application Load Balancer",
        "Regional internal passthrough Network Load Balancer",
        "Regional external passthrough Network Load Balancer",
        "Internal Application Load Balancer",
      ],
      answerIndex: 0,
      rationale:
        "The global external Application Load Balancer provides a single anycast IP, global content-based routing to the nearest healthy backend, and managed TLS termination — exactly what a worldwide HTTPS application needs.",
    },
  },
  {
    id: "ci_q_iam",
    type: "question",
    title: "Applying least privilege with IAM roles",
    topicSlugs: ["iam", "security-compliance"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      stem: "A service account for a batch job only needs to read objects from one Cloud Storage bucket. Following least privilege, which role assignment is best?",
      options: [
        "Grant roles/storage.objectViewer on the specific bucket",
        "Grant roles/storage.admin at the project level",
        "Grant the primitive Editor role at the project level",
        "Grant roles/owner on the project",
      ],
      answerIndex: 0,
      rationale:
        "Least privilege means granting the narrowest predefined role at the smallest scope. roles/storage.objectViewer on the single bucket gives read-only object access exactly where needed. Project-level admin/primitive roles grant far more than required.",
    },
  },
  {
    id: "ci_q_compute_choice",
    type: "question",
    title: "Choosing a compute platform for a stateless container",
    topicSlugs: ["compute-design"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      stem: "You have a stateless containerized HTTP API with spiky traffic that can scale to zero between bursts, and you want minimal infrastructure management. Which platform fits best?",
      options: [
        "Cloud Run",
        "A zonal Compute Engine VM",
        "A self-managed Kubernetes cluster on Compute Engine",
        "Cloud Functions (1st gen) with a 9-minute timeout",
      ],
      answerIndex: 0,
      rationale:
        "Cloud Run runs stateless containers, scales to zero, autoscales with traffic, and is fully managed — ideal for a spiky stateless HTTP API. A single VM cannot scale to zero, self-managed Kubernetes adds operational burden, and Cloud Functions is less suited to arbitrary container images.",
    },
  },
  {
    id: "ci_q_dr",
    type: "question",
    title: "Selecting a disaster recovery pattern for a low RTO",
    topicSlugs: ["disaster-recovery", "reliability-operations"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      stem: "A regulated application requires an RTO of under 15 minutes and an RPO of a few minutes, while controlling steady-state cost. Which disaster recovery strategy is most appropriate?",
      options: [
        "Warm standby in a second region with continuous data replication",
        "Backup and restore from nightly snapshots",
        "Cold standby with infrastructure created only after an outage",
        "Single-region deployment with daily exports to Cloud Storage",
      ],
      answerIndex: 0,
      rationale:
        "A warm standby keeps a scaled-down replica running in a second region with continuous replication, enabling fast failover (low RTO) and minimal data loss (low RPO) at lower cost than full hot/active-active. Backup-and-restore and cold standby cannot meet a sub-15-minute RTO.",
    },
  },
  {
    id: "ci_q_cost_cud",
    type: "question",
    title: "Reducing cost for predictable steady-state compute",
    topicSlugs: ["cost-optimization", "optimize-processes"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      stem: "Your analysis shows a stable 24/7 baseline of Compute Engine usage that will continue for at least one year. Which option reduces cost the most for that baseline?",
      options: [
        "Committed use discounts (CUDs)",
        "Spot VMs for the entire baseline",
        "Sustained use discounts only",
        "Switching all instances to preemptible nightly",
      ],
      answerIndex: 0,
      rationale:
        "Committed use discounts provide the deepest savings for predictable, steady-state usage in exchange for a 1- or 3-year commitment. Spot/preemptible VMs can be reclaimed and are unsuitable for an always-on baseline; sustained use discounts apply automatically but are smaller than CUDs.",
    },
  },
  {
    id: "ci_q_cmek",
    type: "question",
    title: "Meeting key-control requirements with encryption",
    topicSlugs: ["data-security", "security-compliance"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      stem: "A compliance mandate requires that your organization control the encryption key lifecycle (rotation and disabling) for data at rest in Cloud Storage, without managing key material on-premises. What should you implement?",
      options: [
        "Customer-managed encryption keys (CMEK) with Cloud KMS",
        "Default Google-managed encryption keys",
        "Customer-supplied encryption keys (CSEK) stored on a laptop",
        "Application-layer encryption with keys hardcoded in code",
      ],
      answerIndex: 0,
      rationale:
        "CMEK with Cloud KMS lets you create, rotate, disable, and destroy the keys protecting your data while Google handles the cryptographic operations. Google-managed keys give no lifecycle control; CSEK shifts key storage burden to you; hardcoded keys are insecure.",
    },
  },
  // ---- Lessons ------------------------------------------------------------
  {
    id: "ci_l_iac_overview",
    type: "lesson",
    title: "Infrastructure as Code on Google Cloud",
    topicSlugs: ["infrastructure-as-code", "manage-infrastructure"],
    sourceVersionIds: ["sv_arch_docs_v1", "sv_exam_guide_v1"],
    body: {
      markdown: `## Infrastructure as Code on Google Cloud

Infrastructure as code (IaC) lets you define cloud resources declaratively so deployments are **repeatable, reviewable, and version-controlled**.

### Google Cloud's native IaC service
**Google Cloud Deployment Manager** is the Google-native IaC service. You describe the resources you want — networks, instances, firewall rules — in **YAML** configuration files, optionally using **Python or Jinja2 templates** for parameterization and reuse. Deployment Manager then creates and updates those resources as a single deployment.

### Why it matters for architects
- **Repeatability:** identical environments for dev, staging, and prod.
- **Auditability:** configuration lives in source control alongside application code.
- **Consistency:** reduces manual, error-prone Console changes.

### Best practices
1. Keep templates small and composable.
2. Parameterize environment-specific values.
3. Store templates in a version-controlled repository and review changes via pull requests.`,
    },
  },
  {
    id: "ci_l_waf_reliability",
    type: "lesson",
    title: "The Reliability Pillar of the Architecture Framework",
    topicSlugs: ["well-architected-framework", "reliability-operations"],
    sourceVersionIds: ["sv_arch_docs_v1"],
    body: {
      markdown: `## Reliability in the Google Cloud Architecture Framework

The **Google Cloud Architecture Framework** describes best practices across operational excellence, security, reliability, cost optimization, and performance.

### Reliability essentials
- **Define SLOs** based on user-centric service level indicators (SLIs).
- **Use error budgets** to balance feature velocity against stability.
- **Build redundancy** across zones and, where required, regions.
- **Plan disaster recovery** using explicit RPO and RTO targets.

### Putting it together
Reliable architectures combine redundancy, automated health checks, and tested recovery procedures so that the system degrades gracefully rather than failing outright.`,
    },
  },
  {
    id: "ci_l_genai_vertex",
    type: "lesson",
    title: "Building with Generative AI on Vertex AI",
    topicSlugs: ["generative-ai"],
    sourceVersionIds: ["sv_arch_docs_v1"],
    body: {
      markdown: `## Generative AI on Google Cloud

**Vertex AI** is Google Cloud's managed platform for machine learning. It provides access to **foundation models** that you can use for prediction workloads.

### Typical pattern
1. Choose a foundation model in Vertex AI.
2. Tune or prompt the model for your task.
3. Deploy an endpoint and call it from your application.

Generative AI is an emerging area; architects should understand where managed model services fit into a solution.`,
    },
  },
  {
    id: "ci_l_storage_options",
    type: "lesson",
    title: "Choosing a Storage Service on Google Cloud",
    topicSlugs: ["storage-design"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      markdown: `## Choosing a Storage Service

Match the storage service to the **access pattern and data shape**:

| Need | Service |
| --- | --- |
| Unstructured objects (images, backups) | **Cloud Storage** (Standard / Nearline / Coldline / Archive) |
| Relational, regional, < a few TB | **Cloud SQL** |
| Global, horizontally scalable relational | **Cloud Spanner** |
| Document / mobile sync | **Firestore** |
| Wide-column, high-throughput | **Bigtable** |
| Analytics / data warehouse | **BigQuery** |

### Cloud Storage classes
Pick the class by access frequency: Standard (frequent), Nearline (~monthly), Coldline (~quarterly), Archive (< yearly). Lifecycle rules can transition objects automatically to cheaper classes.`,
    },
  },
  {
    id: "ci_l_networking_vpc",
    type: "lesson",
    title: "VPC Design and Hybrid Connectivity",
    topicSlugs: ["network-design"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      markdown: `## VPC Design and Hybrid Connectivity

A **Virtual Private Cloud (VPC)** on Google Cloud is global; subnets are regional. Design considerations:

- **Subnets & IP ranges:** plan non-overlapping CIDR ranges, especially for hybrid and multi-VPC scenarios.
- **Shared VPC:** centralize network administration while letting service projects attach.
- **Hybrid connectivity:** use **Cloud VPN** for encrypted tunnels over the internet, or **Cloud Interconnect** for dedicated, low-latency, high-bandwidth links to on-premises.
- **Firewall rules:** apply least-privilege ingress/egress with network tags or service accounts.

Choose connectivity based on bandwidth, latency, and SLA requirements.`,
    },
  },
  {
    id: "ci_l_sre_monitoring",
    type: "lesson",
    title: "SLIs, SLOs, and Cloud Monitoring",
    topicSlugs: ["sre-monitoring", "reliability-operations"],
    sourceVersionIds: ["sv_exam_guide_v1"],
    body: {
      markdown: `## SLIs, SLOs, and Cloud Monitoring

Site Reliability Engineering (SRE) makes reliability measurable.

- **SLI (indicator):** a quantitative measure of service behavior, e.g. request latency or availability.
- **SLO (objective):** a target value for an SLI over a window, e.g. 99.9% of requests succeed per 28 days.
- **Error budget:** 1 − SLO; the allowable unreliability that governs release risk.

**Cloud Monitoring** and **Cloud Logging** collect metrics and logs; use them to define SLOs, dashboards, and alerting policies. Alert on **symptoms users feel** (latency, errors) rather than every low-level cause.`,
    },
  },
];

// ---------------------------------------------------------------------------
// The "Google Cloud Next" simulated change (v2 of each source) + change events
// ---------------------------------------------------------------------------

export const SEED_SOURCE_CHANGES: SeedSourceChange[] = [
  {
    sourceId: "src_exam_guide",
    newVersion: {
      id: "sv_exam_guide_v2",
      title: "Professional Cloud Architect Exam Guide (Rev. 2025 — Cloud Next)",
      body: `Section 2: Managing and provisioning a solution infrastructure
2.1 Configuring network topologies. Considerations include VPC design, hybrid connectivity (Cloud VPN, Cloud Interconnect), and load balancing.
2.2 Configuring individual storage systems. Considerations include data storage allocation, processing/compute capacity, and Cloud Storage class selection.
2.3 Configuring compute systems. Considerations include managed instance groups, autoscaling policies, and infrastructure provisioning using Infrastructure Manager (the Terraform-based successor to Deployment Manager) for repeatable, declarative deployments. NOTE: Deployment Manager is deprecated and scheduled for shutdown; new designs should use Infrastructure Manager or Terraform.

Section 4: Analyzing and optimizing technical and business processes
4.1 Cost optimization. Considerations include committed use discounts, rightsizing, and Active Assist recommendations.

Section 5: Ensuring solution and operations reliability
5.1 Monitoring/logging/profiling/alerting. This area is significantly expanded: designing SLIs and SLOs from the user journey, governing releases with error budgets and error-budget policies, and configuring multi-window, multi-burn-rate alerting (fast-burn and slow-burn) to reduce alert fatigue. Candidates should be able to define an error-budget policy that gates feature launches.
5.2 Disaster recovery planning driven by recovery point objective (RPO) and recovery time objective (RTO).

Section 6: Designing for generative AI solutions (NEW EMPHASIS)
6.1 Selecting Vertex AI foundation models, including Gemini, for enterprise workloads.
6.2 Designing retrieval-augmented generation (RAG) and grounding to reduce hallucination.
6.3 Responsible AI, safety, and evaluation of generative outputs.`,
    },
    changes: [
      {
        changeType: "deprecation",
        summary:
          "Deployment Manager deprecated in favor of Infrastructure Manager",
        detail:
          "The exam guide now states Deployment Manager is deprecated and scheduled for shutdown. Infrastructure Manager (Terraform-based) is the recommended Google-native IaC service for new designs. Content recommending Deployment Manager as the answer is now outdated.",
        severity: 0.95,
        affectedTopics: ["infrastructure-as-code", "manage-infrastructure"],
      },
      {
        changeType: "addition",
        summary: "New domain: Designing for generative AI solutions",
        detail:
          "A new exam section covers Vertex AI foundation models (Gemini), retrieval-augmented generation (RAG), grounding, and responsible AI. Existing generative AI content is now under-scoped and lacks RAG/grounding/Gemini coverage.",
        severity: 0.8,
        affectedTopics: ["generative-ai"],
      },
      {
        changeType: "emphasis",
        summary:
          "Reliability section expands error-budget policy and burn-rate alerting",
        detail:
          "Section 5.1 now requires depth on error-budget policies that gate releases and on multi-window, multi-burn-rate alerting. Existing SRE content covers SLIs/SLOs and error budgets only at a high level and should be expanded to cover error-budget policy and burn-rate alerting.",
        severity: 0.7,
        affectedTopics: ["sre-monitoring"],
      },
    ],
  },
  {
    sourceId: "src_arch_docs",
    newVersion: {
      id: "sv_arch_docs_v2",
      title: "Google Cloud Well-Architected Framework (2025 — Cloud Next)",
      body: `Infrastructure as code. Use Infrastructure Manager to provision Google Cloud resources declaratively using Terraform configurations. Infrastructure Manager is the managed, Google-native successor to Deployment Manager, which is now deprecated. You can also use Terraform directly.

Reliability pillar. Build redundancy, define SLOs, and plan disaster recovery based on RPO and RTO targets.

Cost optimization pillar. Apply committed use discounts and review Active Assist recommendations.

Generative AI. Vertex AI provides access to Gemini foundation models. Recommended patterns include retrieval-augmented generation (RAG) with grounding to enterprise data, evaluation of model outputs, and applying Responsible AI safety filters. This framework is now named the Google Cloud Well-Architected Framework (formerly the Architecture Framework).`,
    },
    changes: [
      {
        changeType: "deprecation",
        summary: "Deployment Manager replaced by Infrastructure Manager in docs",
        detail:
          "Architecture docs now direct IaC to Infrastructure Manager (Terraform-based) and label Deployment Manager deprecated. Lessons describing Deployment Manager's YAML/Python/Jinja2 templates as the recommended approach are stale.",
        severity: 0.9,
        affectedTopics: ["infrastructure-as-code", "manage-infrastructure"],
      },
      {
        changeType: "emphasis",
        summary: "Generative AI guidance expanded (Gemini, RAG, grounding)",
        detail:
          "The GenAI section now emphasizes Gemini models, retrieval-augmented generation with grounding, output evaluation, and Responsible AI. Existing GenAI lesson only mentions generic foundation models for prediction.",
        severity: 0.75,
        affectedTopics: ["generative-ai"],
      },
      {
        changeType: "wording",
        summary: "'Architecture Framework' renamed to 'Well-Architected Framework'",
        detail:
          "Google renamed the Architecture Framework to the Well-Architected Framework. Content using the old name should be updated for terminology accuracy.",
        severity: 0.4,
        affectedTopics: ["well-architected-framework"],
      },
    ],
  },
];
