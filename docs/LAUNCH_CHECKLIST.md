# Launch Checklist

## Code
- [ ] All tests pass (`pnpm test`)
- [ ] CI pipeline green
- [ ] SDK builds and exports correctly
- [ ] Token revocation endpoint works
- [ ] OpenClaw integration example runs end-to-end
- [ ] No secrets committed (check with `git log --all -p | grep -i "ap_live\|secret\|password"`)

## npm
- [ ] `@zerobase-labs/passport-sdk` published to npm
- [ ] Package installs cleanly: `npm install @zerobase-labs/passport-sdk`
- [ ] Types work: IDE autocomplete and type checking

## GitHub
- [ ] README is updated with new features (revocation, SDK)
- [ ] Topics added
- [ ] Description set
- [ ] Issues created (roadmap)
- [ ] CONTRIBUTING.md exists
- [ ] Issue templates exist
- [ ] Discussions enabled
- [ ] License file present (MIT)

## Deployment
- [ ] API deployed to Render and responding at `/healthz`
- [ ] Portal deployed to Vercel and loading
- [ ] Database migrated (Prisma)
- [ ] Redis connected (Upstash)
- [ ] JWKS endpoint works: `curl https://agent-passport.onrender.com/.well-known/jwks.json`

## Launch
- [ ] Hacker News "Show HN" post ready
- [ ] X thread drafted (5 tweets)
- [ ] 30-second demo video recorded (optional but high impact)
- [ ] Post HN on Saturday morning (highest traffic)
- [ ] Post X thread same day
- [ ] Monitor HN comments and respond within 1 hour

## Post-Launch (Week 1)
- [ ] Respond to all GitHub issues within 24 hours
- [ ] Fix any critical bugs immediately
- [ ] Write a blog post about the architecture (optional)
- [ ] Submit to Product Hunt (optional, Day 3-4)
- [ ] Post in relevant Discord/Slack communities (AI agents, security)
