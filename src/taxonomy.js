"use strict";

(function (root) {
/**
 * Standards-grounded cloud security taxonomy for Vector.
 *
 * Grounded in:
 *  - CIS AWS Foundations Benchmark, Azure Foundations Benchmark, GCP Foundations
 *  - AWS Well-Architected Framework (Security Pillar)
 *  - AWS Foundational Security Best Practices (FSBP)
 *  - NIST SP 800-53 (AC, SC, AU, CP, IA, SI, PM families)
 *  - Data protection regulations (GDPR, India DPDP Act 2023)
 *
 * Each requirement has keyword patterns used to decide whether the user's
 * prompt already mentions it, plus a ready-to-append clause (the "fillable"
 * output the UI inserts with one click). Patterns are intentionally broad to
 * maximise recall; the analyzer applies a negation guard so "don't encrypt"
 * is not mistaken for "encrypt".
 */

const DIMENSIONS = {
  access_control: "Access Control",
  encryption: "Encryption",
  iam_permissions: "IAM Permissions",
  data_residency: "Data Residency",
  regional_restrictions: "Regional Restrictions",
  audit_logging: "Audit Logging",
  network_exposure: "Network Exposure",
  backup_recovery: "Backup & Recovery",
  versioning: "Versioning & Integrity",
  availability: "Availability / Resilience",
  monitoring: "Monitoring & Detection",
  secrets: "Secrets Management",
  governance: "Governance & Compliance"
};

const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 };

const REQUIREMENTS = [
  {
    id: "encryption_at_rest",
    label: "Encryption at rest",
    dimension: "encryption",
    severity: "high",
    description:
      "Data stored on disk is readable by anyone with access to the underlying media. Encryption at rest protects data if the storage layer is compromised or a snapshot leaks.",
    clause:
      "Encrypt data at rest; specify whether a customer-managed KMS key is required.",
    standards: ["CIS AWS 2.1.1", "AWS FSBP S3.4 / RDS.3", "NIST SP 800-53 SC-28"],
    patterns: ["encrypt(ed|ion)?", "\\bkms\\b", "server[- ]side encryption", "sse[- ]?(s3|kms)", "aes[- ]?256", "at rest", "customer[- ]managed key", "\\bcmk\\b", "disk encryption"],
    notAfter: ["in transit", "over the (network|wire)"]
  },
  {
    id: "encryption_in_transit",
    label: "Encryption in transit (TLS)",
    dimension: "encryption",
    severity: "high",
    description:
      "Traffic can be intercepted or modified on the network. TLS protects data in transit and prevents downgrade / man-in-the-middle attacks.",
    clause:
      "Use TLS 1.2 or higher for every connection and redirect HTTP to HTTPS.",
    standards: ["AWS FSBP ELB.4 / CloudFront.4", "NIST SP 800-53 SC-8"],
    patterns: ["in transit", "\\btls\\b", "\\bssl\\b", "https", "encrypted (connection|traffic)", "certificate", "secure transport", "end[- ]to[- ]end encrypt"]
  },
  {
    id: "public_access_block",
    label: "Restrict public access",
    dimension: "access_control",
    severity: "high",
    description:
      "Publicly reachable storage or endpoints are the single most common cloud data-leak cause. Access should be explicit and private unless there is a deliberate, reviewed reason otherwise.",
    clause:
      "Block all public access and ACLs; expose the resource only through authenticated access.",
    standards: ["CIS AWS 2.1.4", "AWS FSBP S3.1 / S3.2", "NIST SP 800-53 AC-3"],
    patterns: [
      "\\bprivate\\b", "not (be )?public", "no public", "block (all )?(the )?(public|external|anonymous)",
      "deny public", "restrict public", "internal only", "non[- ]public", "authenticated access",
      "disable acl", "don'?t (want|make|allow) (it )?(to be )?public", "should and? ?not be public",
      "avoid public", "public access block", "anonymous access",
      "do\\s+not\\s+make[^.,;]{0,25}public", "not (enable|allow|expose)[^.,;]{0,25}public",
      "without public access", "disable public access", "keep (it |the data )?private"
    ]
  },
  {
    id: "least_privilege_iam",
    label: "Least-privilege IAM",
    dimension: "iam_permissions",
    severity: "high",
    description:
      "Over-broad IAM policies (for example wildcard actions on all resources) grant far more power than needed and turn one compromised component into a full account takeover.",
    clause:
      "Grant only the specific IAM actions and resource ARNs required (least privilege).",
    standards: ["CIS AWS 1.x", "AWS FSBP IAM.1", "NIST SP 800-53 AC-6"],
    patterns: [
      "least privilege", "least[- ]privilege", "scoped (permission|policy|role|access)",
      "specific (actions|permissions|roles?)", "minimum (permission|privilege|access)",
      "no wildcard", "narrow (permission|policy)", "read[- ]only", "fine[- ]grained",
      "least[- ]privileged", "only the (permissions|actions)"
    ]
  },
  {
    id: "no_wildcard_policy",
    label: "No wildcard policies",
    dimension: "iam_permissions",
    severity: "high",
    description:
      "Policies containing '*' in the Action or Resource field effectively grant administrative access.",
    clause:
      "In IAM policies use explicit actions and explicit resources instead of '*', scoped to the minimum required.",
    standards: ["AWS FSBP IAM.1", "CIS AWS 1.16"],
    patterns: ["no wildcard", "explicit actions", "explicit resources", "deny \\*", "avoid \\*", "no \\*:"]
  },
  {
    id: "network_restricted",
    label: "Restrict inbound network exposure",
    dimension: "network_exposure",
    severity: "high",
    description:
      "Security groups open to 0.0.0.0/0 can expose administrative or database ports to the whole internet. Internet-facing application ports are legitimate; management and data ports are not.",
    clause:
      "Restrict inbound to the required app ports (for example 443). Keep administrative and database ports reachable only from trusted networks.",
    standards: ["CIS AWS 5.2 / 5.3", "AWS FSBP EC2.18 / EC2.19", "NIST SP 800-53 SC-7"],
    patterns: [
      "restrict(ed)? (access|inbound|traffic|ports?|security group|ingress)",
      "allowlist", "whitelist", "\\bcidr\\b", "private subnet", "firewall rule",
      "limited (ports|source)", "specific ip", "only (port|from|allow|accept)",
      "ingress (rules?|restrict)", "no inbound", "closed ports", "ip range"
    ]
  },
  {
    id: "audit_logging",
    label: "Audit logging / trail",
    dimension: "audit_logging",
    severity: "high",
    description:
      "Without audit logs there is no record of who did what, so incidents cannot be detected, investigated or attributed.",
    clause:
      "Enable CloudTrail and resource access logs delivered to a central, access-controlled account.",
    standards: ["CIS AWS 3.1", "AWS FSBP CloudTrail.1", "NIST SP 800-53 AU-2 / AU-3"],
    patterns: [
      "cloudtrail", "audit log", "logging", "access log", "log all", "\\btrail\\b",
      "cloudwatch logs", "activity log", "record (api|activity)", "monitor.?(logs?|traffic)",
      "audit trail", "cloud audit", "log everything", "observability", "flow logs?"
    ]
  },
  {
    id: "data_residency",
    label: "Data residency / sovereignty",
    dimension: "data_residency",
    severity: "medium",
    description:
      "The prompt does not state where data may be stored or processed. If personal or regulated data is involved, residency must be specified to meet GDPR / DPDP obligations.",
    clause:
      "If personal or regulated data is involved, define data residency: the approved jurisdictions where data may reside.",
    standards: ["GDPR Art. 5 / 44-49", "India DPDP Act 2023 s.16", "NIST SP 800-53 PM-8"],
    patterns: [
      "data residency", "reside", "sovereignty", "\\bgdpr\\b", "in[- ]country",
      "local(ly)? (region|storage)", "compliance region", "keep data in",
      "within (the )?(eu|india|uk|country|region)", "data locality", "\\bdpdp\\b"
    ]
  },
  {
    id: "regional_restriction",
    label: "Regional restriction",
    dimension: "regional_restrictions",
    severity: "medium",
    description:
      "The prompt does not specify which AWS regions are approved. Unapproved regions can violate policy, increase cost and latency, and break data-residency guarantees.",
    clause:
      "Specify the approved AWS region(s) and restrict deployment to them.",
    standards: ["AWS Well-Architected SEC-06", "NIST SP 800-53 PM-8"],
    patterns: [
      "\\bregion", "regional", "us-east", "us-west", "eu-west", "eu-central",
      "ap-south", "ap-southeast", "specific region", "multi[- ]region", "single region",
      "availability zone", "zoned?"
    ]
  },
  {
    id: "backup_recovery",
    label: "Backup & recovery",
    dimension: "backup_recovery",
    severity: "medium",
    description:
      "Without backups, accidental deletion or ransomware becomes permanent data loss.",
    clause:
      "Enable automated backups with a defined retention period and tested restore procedure, protected against deletion.",
    standards: ["NIST SP 800-53 CP-9", "CIS AWS 2.1.2", "AWS FSBP RDS.14"],
    patterns: [
      "backup", "snapshot", "retention", "point[- ]in[- ]time", "disaster recovery",
      "restore", "recovery (time|point)", "\\brto\\b", "\\brpo\\b", "backup vault"
    ]
  },
  {
    id: "versioning",
    label: "Versioning & integrity",
    dimension: "versioning",
    severity: "medium",
    description:
      "Versioning protects against accidental overwrite/deletion and supports integrity checks and audit.",
    clause:
      "Enable versioning and integrity controls such as object lock.",
    standards: ["CIS AWS 2.1.3", "AWS FSBP S3.5"],
    patterns: ["versioning", "versioned", "mfa delete", "checksum", "integrity", "object lock", "immutable"]
  },
  {
    id: "monitoring_alerting",
    label: "Monitoring & alerting",
    dimension: "monitoring",
    severity: "medium",
    description:
      "Detecting anomalous activity requires monitoring and alerts; logging alone is not enough.",
    clause:
      "Enable continuous monitoring and alerts (for example GuardDuty and Security Hub).",
    standards: ["CIS AWS 4.x", "AWS FSBP GuardDuty.1", "NIST SP 800-53 SI-4"],
    patterns: [
      "monitor", "alert", "guardduty", "security hub", "cloudwatch", "anomaly",
      "intrusion detection", "notification", "notify", "defender", "sentinel",
      "security command center", "soc", "alarm"
    ]
  },
  {
    id: "secrets_management",
    label: "Secrets management",
    dimension: "secrets",
    severity: "high",
    description:
      "Hard-coded credentials in source or prompts leak into repositories and logs.",
    clause:
      "Credentials and secrets must be stored in AWS Secrets Manager or SSM Parameter Store and never hard-coded.",
    standards: ["AWS FSBP RDS.10", "NIST SP 800-53 IA-5", "OWASP A07:2021"],
    patterns: [
      "secret", "secrets manager", "parameter store", "\\bssm\\b", "vault",
      "key vault", "secret manager", "no hard[- ]?cod", "credentials (stored|rotated|managed)",
      "rotate", "environment variable", "injected secret",
      "credential[^.]{0,25}secur", "secur[a-z]*[^.]{0,25}credential",
      "store[^.]{0,20}(credential|password|secret)"
    ]
  },
  {
    id: "availability",
    label: "High availability / resilience",
    dimension: "availability",
    severity: "low",
    description:
      "Single-AZ deployments fail when an availability zone goes down.",
    clause:
      "Deploy across at least two availability zones behind a load balancer with health checks.",
    standards: ["AWS Well-Architected REL-10", "NIST SP 800-53 CP-6"],
    patterns: [
      "multi[- ]az", "availability zone", "highly available", "high availability",
      "\\bha\\b", "failover", "redundant", "load balanc", "replicated", "multiple zones"
    ]
  },
  {
    id: "network_isolation",
    label: "Network isolation (VPC)",
    dimension: "network_exposure",
    severity: "medium",
    description:
      "Resources should sit inside a VPC/VNet with public/private subnet separation to limit lateral movement.",
    clause:
      "Use a VPC with public and private subnets; keep data and compute in private subnets.",
    standards: ["CIS AWS 5.1", "AWS FSBP EC2.15", "NIST SP 800-53 SC-7"],
    patterns: [
      "\\bvpc\\b", "\\bvnet\\b", "subnet", "private subnet", "network isolation",
      "isolated network", "nat gateway", "no internet gateway", "bastion", "network segmentation"
    ]
  },
  {
    id: "waf_protection",
    label: "Edge protection (WAF / DDoS)",
    dimension: "network_exposure",
    severity: "medium",
    description:
      "Internet-facing endpoints should be protected against common web exploits and volumetric attacks.",
    clause:
      "Put a WAF with managed rules and rate limiting in front of public endpoints.",
    standards: ["AWS FSBP WAF.1", "CIS AWS 5.x", "NIST SP 800-53 SC-5"],
    patterns: ["\\bwaf\\b", "web application firewall", "\\bddos\\b", "shield", "rate[- ]limit", "owasp rules?", "bot control", "cloud armor"]
  },
  {
    id: "key_rotation",
    label: "Key rotation",
    dimension: "encryption",
    severity: "medium",
    description:
      "Long-lived encryption keys increase the impact of a key compromise.",
    clause:
      "Enable automatic rotation for KMS keys and secrets.",
    standards: ["CIS AWS 3.7", "AWS FSBP KMS.4"],
    patterns: ["key rotation", "rotate (the )?(key|keys)", "rotation (enabled|period)", "automatic rotation", "renew (key|secret)", "\\brotation\\b"]
  },
  {
    id: "private_endpoint",
    label: "Private connectivity / endpoints",
    dimension: "network_exposure",
    severity: "medium",
    description:
      "Traffic to managed services should not traverse the public internet; private endpoints reduce exposure.",
    clause:
      "Use VPC endpoints (PrivateLink) so managed-service traffic stays off the public internet.",
    standards: ["AWS FSBP EC2.10", "CIS AWS 5.x"],
    patterns: ["private endpoint", "vpc endpoint", "privatelink", "private link", "private connectivity", "private service connect", "service endpoint"]
  },
  {
    id: "imdsv2",
    label: "Instance metadata hardening (IMDSv2)",
    dimension: "network_exposure",
    severity: "medium",
    description:
      "IMDSv1 can be abused via SSRF to steal instance credentials; IMDSv2 requires a session token.",
    clause:
      "Require IMDSv2 and disable IMDSv1 on all instances.",
    standards: ["AWS FSBP EC2.8", "CIS AWS 5.x"],
    patterns: ["imds", "imdsv2", "metadata service", "instance metadata", "session token"]
  },
  {
    id: "mfa",
    label: "Multi-factor authentication",
    dimension: "access_control",
    severity: "high",
    description:
      "Single-factor authentication is easily defeated by credential theft or phishing.",
    clause:
      "Require MFA for all privileged and root access.",
    standards: ["CIS AWS 1.2 / 1.10", "AWS FSBP IAM.6", "NIST SP 800-53 IA-2"],
    patterns: ["\\bmfa\\b", "multi[- ]?factor", "two[- ]?factor", "\\b2fa\\b", "one[- ]time password", "authenticator"]
  },
  {
    id: "password_policy",
    label: "Password / credential policy",
    dimension: "access_control",
    severity: "medium",
    description:
      "Weak password policies make brute-force and credential-stuffing attacks trivial.",
    clause:
      "Enforce a strong password policy (length, complexity, reuse prevention) and credential rotation where applicable.",
    standards: ["CIS AWS 1.8", "NIST SP 800-53 IA-5"],
    patterns: ["password policy", "password complexity", "minimum length", "credential policy", "password rotation", "strong password"]
  },
  {
    id: "data_classification",
    label: "Data classification / sensitive data",
    dimension: "access_control",
    severity: "medium",
    description:
      "Without classifying data you cannot apply proportionate controls or meet privacy obligations.",
    clause:
      "Classify data (public / internal / confidential / PII) and apply matching controls.",
    standards: ["NIST SP 800-53 RA-2", "ISO 27001 A.8.2", "GDPR Art. 5"],
    patterns: ["classif", "\\bpii\\b", "sensitive data", "confidential", "personal data", "data inventory", "data catalog"]
  },
  {
    id: "retention_deletion",
    label: "Retention & secure deletion",
    dimension: "versioning",
    severity: "medium",
    description:
      "Data kept indefinitely increases breach impact and violates storage-limitation rules.",
    clause:
      "Define retention and secure deletion / lifecycle policies so data is not kept longer than necessary.",
    standards: ["GDPR Art. 5(1)(e)", "NIST SP 800-53 SI-12"],
    patterns: ["retention", "lifecycle", "delete (after|when)", "deletion policy", "\\bttl\\b", "purge", "expire"]
  },
  {
    id: "vulnerability_scanning",
    label: "Vulnerability & patch management",
    dimension: "monitoring",
    severity: "medium",
    description:
      "Unpatched systems are a primary initial-access vector.",
    clause:
      "Enable vulnerability scanning and automated patching.",
    standards: ["CIS AWS 4.x", "NIST SP 800-53 RA-5 / SI-2"],
    patterns: ["vulnerability", "inspector", "patch", "\\bcve\\b", "scan(ning)?", "defender for cloud", "security scanner"]
  },
  {
    id: "config_compliance",
    label: "Configuration compliance / drift",
    dimension: "governance",
    severity: "medium",
    description:
      "Configuration drift silently reintroduces insecure defaults over time.",
    clause:
      "Use AWS Config to detect and remediate configuration drift.",
    standards: ["CIS AWS 3.x", "NIST SP 800-53 CM-6", "AWS FSBP Config.1"],
    patterns: ["config rule", "aws config", "compliance", "conformance pack", "drift", "policy as code", "azure policy", "org policy", "baseline"]
  },
  {
    id: "certificate_management",
    label: "Certificate management",
    dimension: "encryption",
    severity: "medium",
    description:
      "Expired or unmanaged certificates cause outages and encourage insecure bypasses.",
    clause:
      "Use managed certificates (for example ACM) with automatic renewal.",
    standards: ["AWS FSBP ACM.1", "NIST SP 800-53 SC-12"],
    patterns: ["certificate", "\\bacm\\b", "cert manager", "renew(ing)? cert", "tls certificate", "cert rotation"]
  },
  {
    id: "cross_region_replication",
    label: "Cross-region resilience",
    dimension: "availability",
    severity: "medium",
    description:
      "A single-region dataset is lost entirely if that region becomes unavailable.",
    clause:
      "Replicate critical data to a second approved region with documented failover.",
    standards: ["AWS Well-Architected REL-13", "NIST SP 800-53 CP-6"],
    patterns: ["cross[- ]region", "replicate", "multi[- ]region", "geo[- ]redundant", "failover region", "secondary region"]
  },
  {
    id: "scp_permission_boundary",
    label: "Guardrails / permission boundaries",
    dimension: "iam_permissions",
    severity: "medium",
    description:
      "Without account-level guardrails a single over-privileged role can disable controls.",
    clause:
      "Apply organisation guardrails (SCPs / permission boundaries) to cap maximum permissions.",
    standards: ["CIS AWS 1.x", "NIST SP 800-53 AC-6"],
    patterns: ["service control policy", "\\bscps?\\b", "permission boundary", "guardrail", "org policy", "organization policy"]
  },
  {
    id: "session_management",
    label: "Session & token management",
    dimension: "access_control",
    severity: "low",
    description:
      "Long-lived sessions and tokens widen the window for credential abuse.",
    clause:
      "Use short-lived sessions / tokens with defined expiry and revocation.",
    standards: ["NIST SP 800-53 AC-12", "CIS AWS 1.x"],
    patterns: ["session (timeout|expiry|expire)", "token (expiry|expire|rotation)", "short[- ]lived", "revoke", "session management"]
  },
  {
    id: "cost_guardrails",
    label: "Cost guardrails",
    dimension: "governance",
    severity: "low",
    description:
      "Unbounded spend is a common operational and security risk (crypto-mining, runaway scale).",
    clause:
      "Set budgets, alarms and quotas to detect and cap unexpected spend.",
    standards: ["AWS Well-Architected COST-05"],
    patterns: ["budget", "cost (alarm|control|guardrail)", "billing alarm", "spend limit", "quota"]
  }
];

/**
 * Curated paraphrase lexicon (polarity-safe). Extends the regex patterns with
 * common alternative phrasings that would otherwise be missed. Deliberately
 * excludes ambiguous/opposite phrasings ("reachable from the internet",
 * "world-readable") which belong to risky statements, not to a control.
 */
const PARAPHRASES = {
  encryption_at_rest: ["scrambled", "\\bcipher\\b", "obfuscated"],
  audit_logging: ["who did what", "record(s)? (of )?(activity|actions)", "activity record", "log (of )?(who|actions)"],
  public_access_block: ["block (anonymous|external)", "deny (anonymous|external)", "no anonymous", "restrict(ed)? (public|external) (access|exposure)"],
  network_restricted: ["locked down", "closed (ports|to the world)", "firewalled", "deny (inbound|ingress) by default", "no inbound"],
  backup_recovery: ["restore point", "recovery point", "automated snapshot"],
  least_privilege_iam: ["minimal (permissions|access)", "just enough", "only what (it|the app) needs"],
  secrets_management: ["secrets? (kept )?(out of|not in) (the )?code"],
  mfa: ["second factor", "two[- ]step", "2[- ]step"],
  data_classification: ["\\bpii\\b", "sensitive data", "confidential"],
  monitoring_alerting: ["\\balarms?\\b", "notify (me|on)", "alerting"],
  versioning: ["keep (old )?versions", "\\bimmutable\\b", "object lock"],
  data_residency: ["(data|it) (must|should) not leave (the )?country", "stay in the country"],
  regional_restriction: ["only in (the )?region", "single[- ]region"]
};

for (const req of REQUIREMENTS) {
  if (PARAPHRASES[req.id]) req.patterns = req.patterns.concat(PARAPHRASES[req.id]);
}

/**
 * Relevance tier per control. Drives how findings are grouped and weighted:
 *   core    - strongly implied security requirement that the prompt omits
 *   clarify - context-dependent; should be clarified, not assumed
 *   harden  - optional hardening / organisation-specific
 */
const TIERS = {
  encryption_at_rest: "core",
  encryption_in_transit: "core",
  public_access_block: "core",
  least_privilege_iam: "core",
  no_wildcard_policy: "core",
  network_restricted: "core",
  network_isolation: "core",
  audit_logging: "core",
  secrets_management: "core",
  backup_recovery: "core",
  mfa: "core",
  data_residency: "clarify",
  regional_restriction: "clarify",
  retention_deletion: "clarify",
  data_classification: "clarify",
  private_endpoint: "clarify",
  waf_protection: "clarify",
  certificate_management: "clarify",
  session_management: "clarify",
  password_policy: "clarify",
  scp_permission_boundary: "clarify",
  cross_region_replication: "clarify",
  imdsv2: "harden",
  monitoring_alerting: "harden",
  vulnerability_scanning: "harden",
  key_rotation: "harden",
  versioning: "harden",
  availability: "harden",
  cost_guardrails: "harden",
  config_compliance: "harden"
};

for (const req of REQUIREMENTS) {
  req.tier = TIERS[req.id] || "clarify";
}

/**
 * Terraform-level hint per control. Turns a prose recommendation into the
 * concrete thing to set in HCL. Deterministic data, no model.
 */
const TF_HINTS = {
  encryption_at_rest: 'storage_encrypted = true / server_side_encryption_configuration { sse_algorithm = "aws:kms" }',
  encryption_in_transit: 'aws_lb_listener { protocol = "HTTPS" } and redirect 80 -> 443',
  public_access_block: "aws_s3_bucket_public_access_block { block_public_acls = true, restrict_public_buckets = true }",
  least_privilege_iam: "aws_iam_policy statement with explicit Action[] and Resource[] (no wildcards)",
  no_wildcard_policy: 'do not use "Action": "*" or "Resource": "*"',
  network_restricted: 'aws_security_group ingress { cidr_blocks = ["10.0.0.0/8"] } on required ports only',
  audit_logging: "aws_cloudtrail (multi-region) and aws_s3_bucket_logging",
  backup_recovery: "aws_db_instance { backup_retention_period = 7 } and aws_backup_plan",
  versioning: 'aws_s3_bucket_versioning { status = "Enabled" }',
  monitoring_alerting: "aws_guardduty_detector and aws_cloudwatch_metric_alarm",
  secrets_management: "aws_secretsmanager_secret + data.aws_secretsmanager_secret_version",
  network_isolation: "private aws_subnet + aws_nat_gateway for egress",
  imdsv2: 'aws_instance { metadata_options { http_tokens = "required" } }',
  mfa: "aws_iam_account_password_policy + enforce MFA on IAM users/root",
  data_residency: 'provider "aws" { region = "<approved>" } and disable cross-region replication',
  regional_restriction: 'provider "aws" { region = "<approved>" }',
  key_rotation: "aws_kms_key { enable_key_rotation = true }",
  private_endpoint: "aws_vpc_endpoint (interface/gateway)",
  waf_protection: "aws_wafv2_web_acl associated with the public endpoint",
  certificate_management: "aws_acm_certificate (+ validation) with auto-renewal",
  data_classification: "resource tags (e.g. tags = { DataClass = \"confidential\" })",
  retention_deletion: "aws_s3_bucket_lifecycle_configuration { expiration { days = N } }",
  vulnerability_scanning: "aws_inspector2_enabler and SSM patch baselines",
  config_compliance: "aws_config_config_rule for the baseline",
  availability: "multi_az = true (RDS) / subnets across >= 2 AZs",
  cost_guardrails: "aws_budgets_budget with alerts",
  cross_region_replication: "second-region replica resource",
  scp_permission_boundary: "aws_organizations_policy (SCP) / iam permission boundary",
  session_management: "short MaxSessionDuration in IAM roles",
  password_policy: "aws_iam_account_password_policy"
};

for (const req of REQUIREMENTS) {
  req.tf = TF_HINTS[req.id] || "";
}

/**
 * Context cues used to adjust relevance + risk. Deterministic keyword sets.
 */
const CONTEXT_CUES = {
  dev: ["dev", "development", "sandbox", "test", "staging", "poc", "throwaway", "prototype"],
  prod: ["production", "prod", "live", "customer-facing", "customer data", "regulated", "pci", "hipaa", "pii", "personal data"]
};

const ENV_FACTOR = { dev: 0.75, prod: 1.1, unknown: 1 };


/**
 * Terms that indicate a NON-AWS cloud. Used to warn instead of silently
 * applying AWS baseline controls to an Azure/GCP prompt.
 */
const NON_AWS_TERMS = [
  "azure", "microsoft cloud", "\\bgcp\\b", "google cloud", "google cloud platform",
  "\\bgke\\b", "\\baks\\b", "bigquery", "cosmos ?db", "cloud armor", "cloud run",
  "alibaba cloud", "oracle cloud", "\\boci\\b", "digitalocean", "\\bblob storage\\b"
];

/** Baseline controls that apply to most AWS resources. */
const DEFAULT_REQUIRED = [
  "encryption_at_rest",
  "encryption_in_transit",
  "least_privilege_iam",
  "audit_logging",
  "regional_restriction"
];

/**
 * AWS resource / intent vocabulary.
 * `required` is merged with DEFAULT_REQUIRED unless `noDefaults` is set
 * (used for identity/governance services where encryption does not apply).
 */
const RAW_RESOURCES = [
  { id: "s3", label: "S3 bucket (AWS)", aliases: ["s3", "simple storage service", "object storage", "bucket", "s3 bucket", "aws s3"], required: ["public_access_block", "data_residency", "versioning", "backup_recovery", "data_classification", "retention_deletion"] },
  { id: "ec2", label: "EC2 instance (AWS)", aliases: ["ec2", "ec2 instance", "virtual machine", "\\bvm\\b", "instance", "compute node", "amazon ec2"], required: ["network_restricted", "network_isolation", "secrets_management", "vulnerability_scanning", "imdsv2", "monitoring_alerting"] },
  { id: "ebs", label: "EBS volume (AWS)", aliases: ["ebs", "ebs volume", "block storage", "attached volume"], required: ["key_rotation", "backup_recovery", "imdsv2"] },
  { id: "iam", label: "IAM role / policy (AWS)", aliases: ["iam role", "iam policy", "iam", "service account", "access key", "instance profile"], noDefaults: true, required: ["least_privilege_iam", "no_wildcard_policy", "audit_logging"] },
  { id: "iam_account", label: "IAM account / identity (AWS)", aliases: ["iam users", "iam user", "admin user", "admin account", "user account", "root account", "root user", "password policy", "organizations", "active directory", "managed ad", "identity provider", "users and groups", "directory service", "\\bmfa\\b"], noDefaults: true, required: ["mfa", "password_policy", "session_management", "scp_permission_boundary", "audit_logging"] },
  { id: "rds", label: "RDS / managed database (AWS)", aliases: ["rds", "database", "db instance", "aurora", "mysql", "postgres", "postgresql", "sql server", "database instance", "relational database"], required: ["public_access_block", "data_residency", "network_restricted", "secrets_management", "backup_recovery", "key_rotation", "monitoring_alerting"] },
  { id: "dynamodb", label: "DynamoDB / NoSQL (AWS)", aliases: ["dynamodb", "nosql", "key[- ]value store", "document database", "table store"], required: ["data_residency", "backup_recovery", "key_rotation", "retention_deletion", "monitoring_alerting"] },
  { id: "lambda", label: "Lambda / serverless (AWS)", aliases: ["lambda", "serverless", "faas", "cloud function", "function as a service", "aws lambda"], required: ["no_wildcard_policy", "secrets_management", "monitoring_alerting"] },
  { id: "vpc", label: "VPC / network (AWS)", aliases: ["vpc", "virtual private cloud", "subnet", "route table", "nat gateway", "network acl"], required: ["network_isolation", "network_restricted", "private_endpoint", "monitoring_alerting"] },
  { id: "load_balancer", label: "Load balancer / endpoint (AWS)", aliases: ["load balancer", "\\balb\\b", "\\bnlb\\b", "\\belb\\b", "application gateway", "endpoint", "elastic load"], required: ["network_restricted", "waf_protection", "certificate_management", "monitoring_alerting"] },
  { id: "kms", label: "KMS key (AWS)", aliases: ["kms", "key management", "encryption key", "customer managed key", "aws kms"], required: ["key_rotation", "no_wildcard_policy"] },
  { id: "cloudtrail", label: "CloudTrail / logging service (AWS)", aliases: ["cloudtrail", "\\btrail\\b", "audit service", "central logging"], required: ["config_compliance", "monitoring_alerting"] },
  { id: "eks", label: "EKS / container platform (AWS)", aliases: ["eks", "kubernetes", "\\bk8s\\b", "container cluster", "container service"], required: ["network_isolation", "network_restricted", "secrets_management", "vulnerability_scanning", "monitoring_alerting", "key_rotation"] },
  { id: "secrets", label: "Secrets manager (AWS)", aliases: ["secrets manager", "parameter store", "\\bssm\\b", "secret store"], required: ["key_rotation", "data_classification"] },
  { id: "sqs", label: "SQS queue (AWS)", aliases: ["sqs", "queue", "message queue", "simple queue"], required: ["key_rotation", "retention_deletion"] },
  { id: "sns", label: "SNS topic (AWS)", aliases: ["sns", "topic", "notification service", "pub.?sub", "simple notification"], required: ["key_rotation", "public_access_block"] },
  { id: "kinesis", label: "Kinesis / streaming (AWS)", aliases: ["kinesis", "stream", "streaming", "data stream", "firehose"], required: ["data_residency", "key_rotation", "retention_deletion", "monitoring_alerting"] },
  { id: "glue", label: "Glue / ETL (AWS)", aliases: ["glue", "\\betl\\b", "data pipeline", "crawler", "data integration"], required: ["data_residency", "key_rotation", "secrets_management", "data_classification", "monitoring_alerting"] },
  { id: "redshift", label: "Redshift / warehouse (AWS)", aliases: ["redshift", "data warehouse", "warehouse"], required: ["public_access_block", "data_residency", "network_restricted", "secrets_management", "backup_recovery", "key_rotation", "private_endpoint"] },
  { id: "elasticache", label: "ElastiCache / cache (AWS)", aliases: ["elasticache", "redis", "memcached", "cache", "caching layer"], required: ["network_restricted", "secrets_management", "backup_recovery", "key_rotation"] },
  { id: "cloudfront", label: "CloudFront / CDN (AWS)", aliases: ["cloudfront", "\\bcdn\\b", "content delivery", "edge location"], required: ["public_access_block", "certificate_management", "waf_protection"] },
  { id: "route53", label: "Route 53 / DNS (AWS)", aliases: ["route.?53", "\\bdns\\b", "hosted zone", "domain name"], required: ["certificate_management", "monitoring_alerting"] },
  { id: "api_gateway", label: "API Gateway (AWS)", aliases: ["api gateway", "rest api", "http api", "api endpoint"], required: ["waf_protection", "certificate_management", "secrets_management", "monitoring_alerting"] },
  { id: "efs", label: "EFS / file storage (AWS)", aliases: ["efs", "elastic file system", "file storage", "nfs", "shared file"], required: ["data_residency", "network_restricted", "backup_recovery", "key_rotation"] },
  { id: "fsx", label: "FSx / managed file system (AWS)", aliases: ["fsx", "windows file server", "lustre", "netapp"], required: ["network_restricted", "backup_recovery", "key_rotation"] },
  { id: "stepfunctions", label: "Step Functions / orchestration (AWS)", aliases: ["step function", "orchestration", "state machine", "workflow engine"], required: ["no_wildcard_policy", "secrets_management", "monitoring_alerting"] },
  { id: "eventbridge", label: "EventBridge / event bus (AWS)", aliases: ["eventbridge", "event bus", "event driven", "scheduler"], required: ["secrets_management", "monitoring_alerting"] },
  { id: "cognito", label: "Cognito / identity provider (AWS)", aliases: ["cognito", "user pool", "authentication service"], noDefaults: true, required: ["mfa", "password_policy", "session_management", "data_classification", "audit_logging"] },
  { id: "waf", label: "WAF (AWS)", aliases: ["\\bwaf\\b", "web application firewall", "network firewall"], noDefaults: true, required: ["monitoring_alerting", "audit_logging"] },
  { id: "sagemaker", label: "SageMaker / ML (AWS)", aliases: ["sagemaker", "machine learning", "ml model", "training job", "ml endpoint"], required: ["public_access_block", "data_residency", "network_restricted", "private_endpoint", "data_classification", "secrets_management", "key_rotation"] },
  { id: "opensearch", label: "OpenSearch / search (AWS)", aliases: ["opensearch", "elasticsearch", "search cluster", "search engine"], required: ["public_access_block", "network_restricted", "backup_recovery", "key_rotation", "monitoring_alerting"] },
  { id: "msk", label: "MSK / Kafka (AWS)", aliases: ["msk", "kafka", "event streaming", "broker"], required: ["network_restricted", "key_rotation", "monitoring_alerting", "secrets_management"] },
  { id: "autoscaling", label: "Auto Scaling (AWS)", aliases: ["auto.?scal", "scaling group", "\\basg\\b", "scaling policy"], noDefaults: true, required: ["availability", "cost_guardrails", "monitoring_alerting"] },
  { id: "ecs", label: "ECS / Fargate (AWS)", aliases: ["\\becs\\b", "fargate", "elastic container service", "task definition"], required: ["network_isolation", "secrets_management", "vulnerability_scanning", "monitoring_alerting", "key_rotation"] },
  { id: "ecr", label: "ECR container registry (AWS)", aliases: ["\\becr\\b", "container registry", "image registry", "docker registry"], required: ["public_access_block", "vulnerability_scanning", "key_rotation", "config_compliance"] },
  { id: "athena", label: "Athena / query (AWS)", aliases: ["athena", "serverless query", "presto"], required: ["data_residency", "data_classification", "key_rotation"] },
  { id: "emr", label: "EMR / big data (AWS)", aliases: ["\\bemr\\b", "hadoop", "spark cluster", "big data cluster"], required: ["network_restricted", "secrets_management", "vulnerability_scanning", "imdsv2", "monitoring_alerting", "key_rotation"] },
  { id: "batch", label: "AWS Batch (AWS)", aliases: ["\\bbatch\\b", "batch job", "job queue"], required: ["no_wildcard_policy", "secrets_management", "network_isolation", "monitoring_alerting"] },
  { id: "macie", label: "Macie / sensitive data discovery (AWS)", aliases: ["macie", "sensitive data discovery", "\\bdlp\\b", "data loss prevention"], noDefaults: true, required: ["data_residency", "data_classification", "audit_logging"] },
  { id: "inspector", label: "Inspector / vulnerability (AWS)", aliases: ["inspector", "vulnerability scanning service", "cve scanning"], noDefaults: true, required: ["least_privilege_iam", "monitoring_alerting"] },
  { id: "guardduty", label: "GuardDuty / threat detection (AWS)", aliases: ["guardduty", "threat detection", "intrusion detection service"], noDefaults: true, required: ["monitoring_alerting", "least_privilege_iam"] },
  { id: "securityhub", label: "Security Hub (AWS)", aliases: ["security hub", "securityhub", "security posture"], noDefaults: true, required: ["monitoring_alerting", "config_compliance"] },
  { id: "awsconfig", label: "AWS Config (AWS)", aliases: ["aws config", "config rule", "conformance pack", "configuration recorder"], noDefaults: true, required: ["config_compliance", "monitoring_alerting", "audit_logging"] },
  { id: "network_firewall", label: "Network Firewall / NACL (AWS)", aliases: ["network firewall", "network acl", "\\bnacl\\b", "firewall manager"], noDefaults: true, required: ["network_isolation", "network_restricted", "audit_logging", "monitoring_alerting"] },
  { id: "shield", label: "Shield / DDoS protection (AWS)", aliases: ["shield", "\\bddos\\b", "ddos protection"], noDefaults: true, required: ["monitoring_alerting", "waf_protection"] },
  { id: "vpn", label: "VPN / Site-to-Site (AWS)", aliases: ["\\bvpn\\b", "site to site", "tunnel", "ipsec"], required: ["network_isolation", "network_restricted", "key_rotation"] },
  { id: "direct_connect", label: "Direct Connect (AWS)", aliases: ["direct connect", "\\bdx\\b", "dedicated connection", "private circuit"], required: ["network_isolation", "network_restricted", "monitoring_alerting"] },
  { id: "transit_gateway", label: "Transit Gateway (AWS)", aliases: ["transit gateway", "\\btgw\\b", "hub network"], required: ["network_isolation", "network_restricted", "monitoring_alerting"] },
  { id: "privatelink", label: "PrivateLink / VPC endpoint (AWS)", aliases: ["privatelink", "private link", "vpc endpoint", "interface endpoint", "gateway endpoint"], required: ["network_isolation", "network_restricted", "monitoring_alerting"] },
  { id: "s3_glacier", label: "S3 Glacier / archive (AWS)", aliases: ["glacier", "archive storage", "deep archive", "cold storage"], required: ["public_access_block", "data_residency", "retention_deletion", "backup_recovery", "key_rotation"] },
  { id: "lakeformation", label: "Lake Formation (AWS)", aliases: ["lake formation", "data lake governance", "data lake"], noDefaults: true, required: ["data_residency", "data_classification", "least_privilege_iam", "no_wildcard_policy"] },
  { id: "organizations", label: "Organizations / Control Tower (AWS)", aliases: ["organizations", "control tower", "service control policy", "\\bscps?\\b", "landing zone"], noDefaults: true, required: ["scp_permission_boundary", "mfa", "config_compliance", "audit_logging"] },
  { id: "aws_backup", label: "AWS Backup (AWS)", aliases: ["aws backup", "backup plan", "backup vault"], required: ["key_rotation", "backup_recovery", "cross_region_replication", "data_residency"] },
  { id: "workspaces", label: "WorkSpaces / VDI (AWS)", aliases: ["workspaces", "virtual desktops?", "\\bvdi\\b", "virtual desktop infrastructure"], required: ["mfa", "network_isolation", "backup_recovery"] },
  { id: "ses", label: "SES / email (AWS)", aliases: ["\\bses\\b", "simple email", "email service", "smtp"], required: ["public_access_block", "no_wildcard_policy"] },
  { id: "transfer", label: "Transfer Family / SFTP (AWS)", aliases: ["transfer family", "\\bsftp\\b", "\\bftp\\b", "managed file transfer"], required: ["network_restricted", "public_access_block", "private_endpoint"] },
  { id: "lightsail", label: "Lightsail (AWS)", aliases: ["lightsail"], required: ["network_restricted", "backup_recovery", "monitoring_alerting"] },
  { id: "apprunner", label: "App Runner (AWS)", aliases: ["app runner", "apprunner"], required: ["no_wildcard_policy", "secrets_management", "monitoring_alerting"] },
  { id: "cloudformation", label: "CloudFormation / IaC (AWS)", aliases: ["cloudformation", "\\bcfn\\b", "infrastructure as code"], noDefaults: true, required: ["no_wildcard_policy", "config_compliance", "secrets_management", "audit_logging"] },
  { id: "cloudwatch", label: "CloudWatch / observability (AWS)", aliases: ["cloudwatch", "cloud watch", "metrics", "alarms?", "dashboards?"], required: ["monitoring_alerting", "retention_deletion"] },
  { id: "acm", label: "ACM / certificate manager (AWS)", aliases: ["\\bacm\\b", "certificate manager", "ssl certificate"], required: ["certificate_management", "key_rotation"] },
  { id: "elastic_beanstalk", label: "Elastic Beanstalk (AWS)", aliases: ["elastic beanstalk", "beanstalk"], required: ["network_restricted", "secrets_management", "vulnerability_scanning", "monitoring_alerting", "imdsv2"] },
  { id: "appsync", label: "AppSync / GraphQL (AWS)", aliases: ["appsync", "graphql api"], required: ["waf_protection", "certificate_management", "secrets_management", "monitoring_alerting"] },
  { id: "amplify", label: "Amplify / hosting (AWS)", aliases: ["amplify", "amplify hosting"], required: ["certificate_management", "waf_protection", "secrets_management"] },
  { id: "codepipeline", label: "CodePipeline / CI-CD (AWS)", aliases: ["codepipeline", "codebuild", "codecommit", "codedeploy", "ci/?cd pipeline"], noDefaults: true, required: ["no_wildcard_policy", "secrets_management", "audit_logging", "least_privilege_iam", "config_compliance"] },
  { id: "xray", label: "X-Ray / tracing (AWS)", aliases: ["x-?ray", "distributed tracing"], required: ["least_privilege_iam", "private_endpoint"] },
  { id: "documentdb", label: "DocumentDB / MongoDB (AWS)", aliases: ["documentdb", "mongo ?db", "document database"], required: ["public_access_block", "data_residency", "network_restricted", "secrets_management", "backup_recovery", "key_rotation", "monitoring_alerting"] },
  { id: "neptune", label: "Neptune / graph DB (AWS)", aliases: ["neptune", "graph database"], required: ["public_access_block", "data_residency", "network_restricted", "secrets_management", "backup_recovery", "key_rotation"] },
  { id: "timestream", label: "Timestream / time series (AWS)", aliases: ["timestream", "time series database"], required: ["key_rotation", "backup_recovery", "data_residency", "retention_deletion"] },
  { id: "memorydb", label: "MemoryDB / Redis (AWS)", aliases: ["memorydb"], required: ["network_restricted", "secrets_management", "backup_recovery", "key_rotation"] },
  { id: "keyspaces", label: "Keyspaces / Cassandra (AWS)", aliases: ["keyspaces", "cassandra"], required: ["network_restricted", "backup_recovery", "key_rotation", "data_residency"] },
  { id: "global_accelerator", label: "Global Accelerator (AWS)", aliases: ["global accelerator", "anycast"], required: ["waf_protection", "certificate_management", "monitoring_alerting"] },
  { id: "vpc_lattice", label: "VPC Lattice (AWS)", aliases: ["vpc lattice"], required: ["network_isolation", "network_restricted", "audit_logging", "monitoring_alerting"] },
  { id: "service_catalog", label: "Service Catalog (AWS)", aliases: ["service catalog"], noDefaults: true, required: ["no_wildcard_policy", "least_privilege_iam", "audit_logging"] },
  { id: "cost_explorer", label: "Cost Explorer / Budgets (AWS)", aliases: ["cost explorer", "cost management", "\\bbudgets?\\b"], noDefaults: true, required: ["cost_guardrails", "least_privilege_iam", "audit_logging"] },
  { id: "identity_center", label: "IAM Identity Center / SSO (AWS)", aliases: ["identity center", "single sign.?on", "\\bsso\\b"], noDefaults: true, required: ["mfa", "session_management", "password_policy", "audit_logging"] },
  { id: "cloudhsm", label: "CloudHSM (AWS)", aliases: ["cloudhsm", "\\bhsm\\b", "hardware security module"], required: ["network_isolation", "audit_logging", "backup_recovery"] },
  { id: "appmesh", label: "App Mesh / service mesh (AWS)", aliases: ["app mesh", "service mesh"], required: ["network_isolation", "encryption_in_transit", "monitoring_alerting", "secrets_management"] }
];

function uniq(arr) {
  return Array.from(new Set(arr));
}

const RESOURCES = RAW_RESOURCES.map(function (r) {
  const base = r.noDefaults ? [] : DEFAULT_REQUIRED;
  return {
    id: r.id,
    label: r.label,
    aliases: r.aliases,
    required: uniq(base.concat(r.required || []))
  };
});

/**
 * Synonym expansion: maps everyday words to canonical cloud nouns so the
 * resource detector fires even when the user avoids product names.
 */
const SYNONYMS = [
  { test: /\b(bucket|object storage|files? in the cloud)\b/i, add: " s3 " },
  { test: /\b(virtual machine|virtual server|server instance|\bvm\b|compute instance|cloud server)\b/i, add: " ec2 " },
  { test: /\b(relational database|\bsql\b|db server|database server)\b/i, add: " rds database " },
  { test: /\b(no\.?sql|key.?value|document store)\b/i, add: " dynamodb " },
  { test: /\b(serverless|function as a service|faas|cloud function)\b/i, add: " lambda serverless " },
  { test: /\b(container(s)?|docker|orchestrat)\b/i, add: " kubernetes eks " },
  { test: /\b(cache|caching)\b/i, add: " redis elasticache " },
  { test: /\b(message queue|queue|broker|messaging)\b/i, add: " sqs " },
  { test: /\b(webserver|web server|web application|web app|website|web service)\b/i, add: " ec2 load balancer " },
  { test: /\b(file system|shared files?|nfs)\b/i, add: " efs " },
  { test: /\b(stream|streaming|real.?time data)\b/i, add: " kinesis " },
  { test: /\b(data lake|analytics|etl|pipeline)\b/i, add: " s3 glue " },
  { test: /\b(ml|machine learning|model training|ai model)\b/i, add: " sagemaker " },
  { test: /\b(identity|login|authentication|sign.?in|users? management)\b/i, add: " iam cognito " },
  { test: /\b(flink|spark|emr|big data)\b/i, add: " emr " },
  { test: /\b(search|index|full.?text)\b/i, add: " opensearch " },
  { test: /\b(dns|domain|hostname|subdomain)\b/i, add: " route53 " },
  { test: /\b(cdn|edge|content delivery)\b/i, add: " cloudfront " },
  { test: /\b(api|rest api|graphql|microservice)\b/i, add: " api gateway " }
];

/** Words/phrases that negate a nearby claim. */
const NEGATION_WORDS = [
  "not", "no", "never", "without", "don't", "dont", "doesn't", "doesnt",
  "didn't", "didnt", "avoid", "prevent", "disable", "disabled", "disallow",
  "forbid", "forbidden", "deny", "denied", "cannot", "can't", "cant",
  "won't", "wont", "wouldn't", "wouldnt", "shouldn't", "shouldnt",
  "neither", "nor", "none", "nothing", "skip", "omit", "exclude",
  "free of", "exempt", "unnecessary", "needless",
  "rather than", "instead of", "as opposed to", "other than", "as well as not"
];

/**
 * Explicitly risky statements. Presence is reported as a finding; the `fix`
 * becomes a fillable clause. A match preceded by a negation is ignored.
 */
const RISKY_PATTERNS = [
  {
    id: "open_ssh",
    pattern: "0\\.0\\.0\\.0/0|::/0|open to (the )?(internet|world|public|anyone)|any ip|all traffic|all ports|unrestricted",
    neutralize: [
      [/0\.0\.0\.0\/0/gi, "a restricted trusted CIDR range"],
      [/\ball ports\b/gi, "only the required ports"],
      [/open to (the )?(internet|world|public|anyone)/gi, "reachable only on required ports"],
      [/\bunrestricted\b/gi, "restricted"]
    ],
    label: "Unrestricted inbound access",
    severity: "high",
    description: "The prompt appears to allow traffic from anywhere, exposing services to the entire internet.",
    fix: "Restrict inbound to a specific trusted CIDR range and open only the required ports."
  },
  {
    id: "public_bucket",
    pattern: "public\\s+(?:s3\\s+|aws\\s+|amazon\\s+)?(?:bucket|blob|storage|files?|object)|public(ly)? (bucket|blob|readable|writable)|world[- ]readable|world[- ]writable|make\\s+(?:it|the|this|a|my)?\\s*(?:s3|aws|amazon|the)?\\s*(?:bucket|blob|storage|files?|object)?\\s*public|public[- ]read|public[- ]write|anonymous (access|read)",
    neutralize: [
      [/make\s+(?:it|the|this|a|my)?\s*(?:s3|aws|amazon|the)?\s*(?:bucket|blob|storage|files?|object)?\s*public/gi, "keep the storage private"],
      [/world[- ]readable/gi, "private"],
      [/world[- ]writable/gi, "private"],
      [/public(ly)? (bucket|blob|readable|writable)/gi, "private storage"]
    ],
    label: "Publicly exposed storage",
    severity: "high",
    description: "The prompt explicitly asks for public storage access, which risks a data breach.",
    fix: "Keep storage private and serve content through a CDN with signed URLs / authenticated access."
  },
  {
    id: "wildcard_iam",
    pattern: "wildcard|\\*:\\*|administratoraccess|admin access|full admin|root access|all permissions|\\* on all|\\* for all|full control|full access",
    neutralize: [
      [/administratoraccess/gi, "least-privilege access"],
      [/admin access/gi, "least-privilege access"],
      [/\bfull admin\b/gi, "scoped access"],
      [/\broot access\b/gi, "scoped access"],
      [/\ball permissions\b/gi, "only the required permissions"],
      [/\bfull access\b/gi, "scoped access"],
      [/\bfull control\b/gi, "scoped control"],
      [/\bwildcard\b/gi, "scoped"]
    ],
    label: "Wildcard / admin IAM permissions",
    severity: "high",
    description: "Wildcard or administrative permissions violate least privilege and massively widen the blast radius.",
    fix: "Scope IAM actions and resources to the minimum required; remove broad '*' permissions."
  },
  {
    id: "no_encryption",
    pattern: "without (encryption|tls|ssl)|no encryption|not encrypted|unencrypted|disable encryption|encryption[^.]{0,12}(disabled|off)|plaintext|plain text|in the clear",
    neutralize: [
      [/without (encryption|tls|ssl)/gi, "with encryption"],
      [/no encryption/gi, "encryption"],
      [/not encrypted/gi, "encrypted"],
      [/unencrypted/gi, "encrypted"],
      [/plain ?text/gi, "encrypted transport"],
      [/in the clear/gi, "encrypted"]
    ],
    label: "Unencrypted data",
    severity: "high",
    description: "The prompt appears to allow unencrypted data, which is almost never acceptable.",
    fix: "Enable encryption at rest and TLS in transit; there is rarely a valid reason to disable it."
  },
  {
    id: "hardcoded_secret",
    pattern: "hard[- ]?cod|password in (the )?code|put the password|api key in|paste the key|inline (password|secret)|embed the (key|secret|password)",
    neutralize: [[/hard[- ]?cod(e|ed|ing)?/gi, "stored in a managed secret store"]],
    label: "Hard-coded credentials",
    severity: "high",
    description: "Hard-coding secrets leaks them into source control, logs and build artifacts.",
    fix: "Store secrets in a managed secret store and inject them at runtime."
  },
  {
    id: "disabled_logging",
    pattern: "disable log|no log|without log|turn off log|stop logging|remove logging|logging (is )?(disabled|off)|logs? (are )?(disabled|off)",
    neutralize: [
      [/disable (logging|logs?)/gi, "enable logging"],
      [/logging (is )?(disabled|off)/gi, "logging enabled"],
      [/no logging/gi, "full logging"],
      [/without logging/gi, "with logging"]
    ],
    label: "Logging disabled",
    severity: "medium",
    description: "Disabling logs destroys the audit trail needed for incident response.",
    fix: "Keep audit and access logging enabled and forwarded to a central account."
  },
  {
    id: "weak_auth",
    pattern: "no mfa|without mfa|no authentication|without authentication|anonymous user|no password|weak password|no authorization",
    neutralize: [
      [/without mfa/gi, "with MFA"],
      [/no mfa/gi, "MFA"],
      [/without authentication/gi, "with authentication"],
      [/no authentication/gi, "authentication"],
      [/weak password/gi, "strong password"]
    ],
    label: "Weak or missing authentication",
    severity: "high",
    description: "Missing authentication or MFA lets attackers reach resources with stolen or no credentials.",
    fix: "Require authentication and MFA for all non-public access."
  },
  {
    id: "public_database",
    pattern: "(public(ly)?|internet)[^.]{0,20}(database|\\bdb\\b|rds|sql)|(database|\\brds\\b|\\bdb\\b)[^.]{0,20}(public|internet)",
    neutralize: [[/public(ly)? accessible (database|db|rds)/gi, "private database"], [/internet[- ]facing (database|db|rds)/gi, "private database"]],
    label: "Publicly reachable database",
    severity: "high",
    description: "A database exposed to the internet is a top breach vector.",
    fix: "Place the database in a private subnet and reach it only from the application tier."
  },
  {
    id: "no_backup",
    pattern: "no backup|without backup|skip backup|disable backup|no snapshot",
    neutralize: [[/no backups?/gi, "automated backups"], [/without backups?/gi, "with automated backups"], [/disable backup/gi, "enable backups"]],
    label: "Backups disabled",
    severity: "medium",
    description: "Without backups, accidental deletion or ransomware becomes permanent loss.",
    fix: "Enable automated backups with a retention period and tested restore."
  }
];

const STANDARDS = {
  sources: [
    "CIS AWS Foundations Benchmark v3.0",
    "AWS Well-Architected Framework - Security Pillar",
    "AWS Foundational Security Best Practices",
    "NIST SP 800-53 Rev. 5 (AC, SC, AU, CP, IA, SI, PM families)",
    "GDPR Article 5 & 32; India DPDP Act 2023 (s.16)"
  ]
};

const VectorTaxonomy = {
  DIMENSIONS,
  SEVERITY_WEIGHT,
  REQUIREMENTS,
  PARAPHRASES,
  TIERS,
  TF_HINTS,
  CONTEXT_CUES,
  ENV_FACTOR,
  NON_AWS_TERMS,
  DEFAULT_REQUIRED,
  RESOURCES,
  SYNONYMS,
  NEGATION_WORDS,
  RISKY_PATTERNS,
  STANDARDS
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = VectorTaxonomy;
}
root.VectorTaxonomy = VectorTaxonomy;
})(typeof globalThis !== "undefined" ? globalThis : this);
