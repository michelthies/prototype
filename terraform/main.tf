terraform {
  required_version = ">= 1.9"
  required_providers {
    hcloud       = { source = "hetznercloud/hcloud", version = "~> 1.49" }
    digitalocean = { source = "digitalocean/digitalocean", version = "~> 2.46" }
  }
}

provider "hcloud" { token = var.hcloud_token }
provider "digitalocean" { token = var.digitalocean_token }

locals {
  ssh_public_key = "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR name-here"
}

resource "hcloud_ssh_key" "default" {
  name       = "prototypes-deploy"
  public_key = local.ssh_public_key
}

resource "digitalocean_ssh_key" "geo" {
  name       = "geo-benchmark-key"
  public_key = local.ssh_public_key
}

resource "hcloud_firewall" "vps" {
  name = "prototypes-vps"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "5432"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "6432"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "3001"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction       = "out"
    protocol        = "tcp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction       = "out"
    protocol        = "udp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction       = "out"
    protocol        = "icmp"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "vps" {
  name         = "prototypes-db"
  server_type  = "ccx23"
  image        = "ubuntu-24.04"
  location     = "nbg1"
  ssh_keys     = [hcloud_ssh_key.default.id]
  firewall_ids = [hcloud_firewall.vps.id]
  user_data    = file("${path.module}/cloud-init-vps.yaml")
}

resource "digitalocean_droplet" "london" {
  name      = "geo-bench-london"
  region    = "lon1"
  size      = "s-1vcpu-512mb-10gb"
  image     = "ubuntu-24-04-x64"
  ssh_keys  = [digitalocean_ssh_key.geo.id]
  user_data = file("${path.module}/cloud-init-geo.yaml")
}

resource "digitalocean_droplet" "new_york" {
  name      = "geo-bench-new-york"
  region    = "nyc3"
  size      = "s-1vcpu-512mb-10gb"
  image     = "ubuntu-24-04-x64"
  ssh_keys  = [digitalocean_ssh_key.geo.id]
  user_data = file("${path.module}/cloud-init-geo.yaml")
}

resource "digitalocean_droplet" "singapore" {
  name      = "geo-bench-singapore"
  region    = "sgp1"
  size      = "s-1vcpu-512mb-10gb"
  image     = "ubuntu-24-04-x64"
  ssh_keys  = [digitalocean_ssh_key.geo.id]
  user_data = file("${path.module}/cloud-init-geo.yaml")
}

resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../ansible/inventory.ini"
  content  = <<-EOT
    [vps]
    ${hcloud_server.vps.ipv4_address}

    [geo]
    london    ansible_host=${digitalocean_droplet.london.ipv4_address}
    singapore ansible_host=${digitalocean_droplet.singapore.ipv4_address}
    new-york  ansible_host=${digitalocean_droplet.new_york.ipv4_address}
  EOT
}

resource "local_file" "ips" {
  filename = "${path.module}/../ips.json"
  content = jsonencode({
    nuernberg-vps     = hcloud_server.vps.ipv4_address
    london-droplet    = digitalocean_droplet.london.ipv4_address
    new-york-droplet  = digitalocean_droplet.new_york.ipv4_address
    singapore-droplet = digitalocean_droplet.singapore.ipv4_address
  })
}