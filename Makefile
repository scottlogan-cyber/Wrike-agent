.PHONY: dev eval hello health

dev:
	npm run dev

eval:
	npm run eval

hello:
	npm run hello-cursor

health:
	curl -s http://localhost:8000/health
