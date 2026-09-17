"use strict";

/**
 * Post-generation verification for Terraform / HCL.
 *
 * Rule-based, offline. Scans a .tf file for the same controls and risky
 * patterns the prompt analyser checks, so you can verify what an LLM actually
 * produced (the "close the loop" step). No model, no network.
 */

(function (root) {
  const CHECKS = [
    {
      id: "public_acl",
      label: "Public S3 ACL",
      severity: "high",
      test: (t) => /acl\s*=\s*"public/i.test(t),
      fix: 'Set acl = "private" and use aws_s3_bucket_public_access_block.'
    },
    {
      id: "no_public_access_block",
      label: "S3 bucket without public access block",
      severity: "high",
      test: (t) => /resource\s+"aws_s3_bucket"/.test(t) && !/aws_s3_bucket_public_access_block/.test(t),
      fix: "Add aws_s3_bucket_public_access_block with block_public_acls = true."
    },
    {
      id: "no_s3_encryption",
      label: "S3 bucket without encryption",
      severity: "high",
      test: (t) => /resource\s+"aws_s3_bucket"/.test(t) && !/server_side_encryption/.test(t),
      fix: "Add server_side_encryption_configuration."
    },
    {
      id: "no_rds_encryption",
      label: "RDS without storage encryption",
      severity: "high",
      test: (t) => /resource\s+"aws_db_instance"/.test(t) && !/storage_encrypted\s*=\s*true/.test(t),
      fix: "Set storage_encrypted = true and kms_key_id."
    },
    {
      id: "open_cidr",
      label: "Security group open to 0.0.0.0/0",
      severity: "high",
      test: (t) => /0\.0\.0\.0\/0/.test(t),
      fix: "Restrict cidr_blocks; never expose SSH/RDP or database ports publicly."
    },
    {
      id: "wildcard_iam",
      label: "Wildcard IAM action or resource",
      severity: "high",
      test: (t) => /Action\s*=\s*"\*"|Resource\s*=\s*"\*"/.test(t),
      fix: "Replace wildcards with explicit actions and resource ARNs."
    },
    {
      id: "hardcoded_secret",
      label: "Hard-coded credential",
      severity: "high",
      test: (t) => /(password|secret|api_key)\s*=\s*"[^"$]{4,}"/i.test(t),
      fix: "Read from aws_secretsmanager_secret_version instead of a literal."
    },
    {
      id: "no_logging",
      label: "No audit logging (CloudTrail)",
      severity: "medium",
      test: (t) => !/aws_cloudtrail/.test(t),
      fix: "Add aws_cloudtrail (multi-region) with an S3 log bucket."
    },
    {
      id: "no_versioning",
      label: "S3 without versioning",
      severity: "medium",
      test: (t) => /resource\s+"aws_s3_bucket"/.test(t) && !/aws_s3_bucket_versioning|versioning/.test(t),
      fix: "Add aws_s3_bucket_versioning with status = \"Enabled\"."
    },
    {
      id: "no_imdsv2",
      label: "EC2 without IMDSv2 enforced",
      severity: "medium",
      test: (t) => /resource\s+"aws_instance"/.test(t) && !/http_tokens\s*=\s*"required"/.test(t),
      fix: 'Add metadata_options { http_tokens = "required" }.'
    },
    {
      id: "no_backup",
      label: "RDS without backups",
      severity: "medium",
      test: (t) => /resource\s+"aws_db_instance"/.test(t) && !/backup_retention_period/.test(t),
      fix: "Set backup_retention_period >= 7."
    }
  ];

  function verifyText(text) {
    const issues = [];
    for (const c of CHECKS) {
      if (c.test(text)) {
        issues.push({
          id: c.id,
          label: c.label,
          severity: c.severity,
          fix: c.fix
        });
      }
    }
    return issues;
  }

  const VectorTfCheck = { verifyText, CHECKS };

  if (typeof module !== "undefined" && module.exports) module.exports = VectorTfCheck;
  root.VectorTfCheck = VectorTfCheck;
})(typeof globalThis !== "undefined" ? globalThis : this);
