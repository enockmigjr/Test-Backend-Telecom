#!/bin/bash
# ============================================================
# Configuration automatique des moniteurs Uptime Kuma
# ============================================================
# Usage :
#   1. Ouvrir http://localhost:3002 et créer un compte admin
#   2. Aller dans Settings → API Keys → générer une clé
#   3. Exporter la clé : export UPTIME_KUMA_API_KEY="uk_..."
#   4. Lancer ce script : bash scripts/setup-uptime-kuma.sh
# ============================================================

set -e

UPTIME_KUMA_URL="${UPTIME_KUMA_URL:-http://localhost:3002}"
UPTIME_KUMA_API_KEY="${UPTIME_KUMA_API_KEY:-}"

if [ -z "$UPTIME_KUMA_API_KEY" ]; then
  echo "❌ UPTIME_KUMA_API_KEY non définie."
  echo ""
  echo "   Étapes pour obtenir une clé API :"
  echo "   1. Ouvrir ${UPTIME_KUMA_URL}"
  echo "   2. Se connecter (ou créer un compte admin)"
  echo "   3. Aller dans Settings (icône engrenage) → API Keys"
  echo "   4. Cliquer 'Generate API Key', copier la clé"
  echo "   5. Relancer avec :"
  echo "      export UPTIME_KUMA_API_KEY=\"uk_votre_cle\""
  echo "      bash scripts/setup-uptime-kuma.sh"
  exit 1
fi

echo "🚀 Configuration des moniteurs Uptime Kuma..."
echo "   URL : ${UPTIME_KUMA_URL}"
echo ""

# Fonction pour créer un moniteur via l'API
create_monitor() {
  local name="$1"
  local type="$2"
  local url="$3"
  local interval="${4:-60}"

  echo "   → Création du moniteur : ${name} (${type})"

  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${UPTIME_KUMA_URL}/api/v1/monitors" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${UPTIME_KUMA_API_KEY}" \
    -d "{
      \"name\": \"${name}\",
      \"type\": \"${type}\",
      \"url\": \"${url}\",
      \"interval\": ${interval},
      \"maxretries\": 3,
      \"retryInterval\": 30,
      \"upsideDown\": false,
      \"notificationIDList\": {}
    }")

  case "$response" in
    200|201) echo "      ✅ Créé avec succès" ;;
    400)    echo "      ⚠️  Le moniteur existe peut-être déjà" ;;
    *)      echo "      ❌ Erreur HTTP ${response}" ;;
  esac
}

# ─── Moniteurs essentiels ───────────────────────────────────

# 1. API Health (liveness)
create_monitor \
  "Telecom API — Health" \
  "http" \
  "http://api:3000/api/v1/health" \
  60

# 2. API Readiness (DB + Redis)
create_monitor \
  "Telecom API — Readiness" \
  "http" \
  "http://api:3000/api/v1/health/ready" \
  60

# 3. Grafana
create_monitor \
  "Grafana" \
  "http" \
  "http://grafana:3000/api/health" \
  120

# 4. Prometheus
create_monitor \
  "Prometheus" \
  "http" \
  "http://prometheus:9090/-/healthy" \
  120

# 5. Alertmanager
create_monitor \
  "Alertmanager" \
  "http" \
  "http://alertmanager:9093/-/healthy" \
  120

# 6. Nginx (reverse proxy)
create_monitor \
  "Nginx" \
  "http" \
  "http://nginx:80/health" \
  60

echo ""
echo "✅ Configuration terminée. Vérifier les moniteurs sur ${UPTIME_KUMA_URL}/dashboard"
echo ""
echo "💡 Pour lancer ce script automatiquement au démarrage de docker compose :"
echo "   Ajouter dans docker-compose.yml (service uptime-kuma) :"
echo "   docker compose exec -T uptime-kuma sh -c 'sleep 30 && ...'"
