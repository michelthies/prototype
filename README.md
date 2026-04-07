# Local setup

Prerequisites: Node.js, pnpm, Docker

1. Find and replace all occurances of:

        "XXXXXXXXXX" (DB password)
        "YYYYYYYYYY" (JWT secret) use `openssl rand -hex 32` to generate JWT secret

2. Run setup:

        pnpm install
        docker compose up -d --build
        pnpm db:seed

3. Run tests:

        pnpm test:local

# Remote setup

Prerequisites: Terraform, Ansible and an account with Cloudflare, Hetzner, DigitalOcean.

1. Find and replace all occurances of:

        "SSSSSSSSSS" (SSH key filename)
        "XXXXXXXXXX" (DB password)
        "YYYYYYYYYY" (JWT secret)

2. Create `terraform/terraform.tfvars`:

        hcloud_token = <hetzner-api-token>
        digitalocean_token = <digitalocean-api-token>
        ssh_public_key = <ssh-public-key>

3. Provision infrastructure:

        pnpm infra:up

4. Find and replace all occurances of 

        "TTTTTTTTTT" (VPS IP)
        "WWWWWWWWWW" (VPS domain)

5. Create two Hyperdrive instances pointing to the db host:

        pnpm --filter worker exec wrangler hyperdrive create hyperdrive --connection-string="postgresql://agency_hyperdrive:XXXXXXXXXX@TTTTTTTTTT:5432/tenant_db" --caching-disabled --origin-connection-limit=20

        pnpm --filter worker exec wrangler hyperdrive create hyperdrive-pop --connection-string="postgresql://agency_hyperdrive:XXXXXXXXXX@TTTTTTTTTT:5432/tenant_db" --caching-disabled --origin-connection-limit=20

   Find and replace `UUUUUUUUUU` and `VVVVVVVVVV` with the corresponding hyperdrive IDs.

6. Add the worker subdomain to the `.env`:

        WORKER_SUBDOMAIN=<subdomain.workers.dev>

7. Run setup:

        pnpm run setup

8. Deploy workers:

        pnpm deploy:workers

9. Run tests:

        pnpm test:remote

10. Take down

        pnpm infra:down
        pnpm delete:workers


# Generative Ai

Generative Ai was used to assist in setting up the test runner and infrastructure orchestration.

Tools used:
Claude Sonnet 4.6 chat interface.

The following files/functions were written with the assistance of the LLM, in a collaborative manner, with back-and-forth question-answer loops and manual review/adjustments:

Test runner orchestration:

        scripts/test.ts:
        - helper utilities in: nextRunDir()
        - regex / log parsing in: parseRoutingLogs(), parsePerLevelIsolates()
        - SSH / process management in: execSsh(), sshRead(), fullReset(), runRemote()

Automated infrastructure provisioning:

        terraform/main.tf
        terraform/cloud-init-vps.yaml
        terraform/cloud-init-geo.yaml

Automated infrastructure configuration:

        ansible/setup.yml
        ansible.cfg