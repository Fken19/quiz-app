# Quiz App Makefile for Docker operations

.PHONY: help build up down restart logs clean dev prod

help: ## ヘルプを表示
	@echo "Quiz App Docker Commands:"
	@echo "========================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Docker イメージをビルド
	docker-compose build

up: ## 開発環境を起動
	docker-compose up -d

down: ## 環境を停止
	docker-compose down

restart: ## 環境を再起動
	docker-compose restart

logs: ## 全サービスのログを表示
	docker-compose logs -f

logs-frontend: ## フロントエンドのログを表示
	docker-compose logs -f frontend

logs-backend: ## バックエンドのログを表示
	docker-compose logs -f backend

logs-db: ## データベースのログを表示
	docker-compose logs -f db

clean: ## コンテナ、イメージ、ボリュームを削除
	docker-compose down -v --rmi all

dev: ## 開発環境をセットアップ（初回用）
	@echo "🐳 開発環境をセットアップ中..."
	docker-compose down
	docker-compose build
	docker-compose up -d db
	@echo "⏳ データベースの起動を待機中..."
	@sleep 10
	docker-compose up -d backend
	@echo "⏳ バックエンドの起動を待機中..."
	@sleep 15
	docker-compose up -d frontend
	@echo "✅ 開発環境のセットアップが完了しました！"
	@echo "📋 アクセス先:"
	@echo "   - フロントエンド: http://localhost:3000"
	@echo "   - バックエンド: http://localhost:8080"

prod: ## 本番環境を起動
	docker-compose -f docker-compose.prod.yml up -d

prod-build: ## 本番環境をビルドして起動
	docker-compose -f docker-compose.prod.yml build
	docker-compose -f docker-compose.prod.yml up -d

prod-down: ## 本番環境を停止
	docker-compose -f docker-compose.prod.yml down

shell-frontend: ## フロントエンドコンテナにアクセス
	docker-compose exec frontend sh

shell-backend: ## バックエンドコンテナにアクセス
	docker-compose exec backend bash

shell-db: ## データベースにアクセス
	docker-compose exec db psql -U postgres -d quiz_db

migrate: ## Django マイグレーションを実行
	docker-compose exec backend python manage.py migrate

makemigrations: ## Django マイグレーションファイルを作成
	docker-compose exec backend python manage.py makemigrations

collectstatic: ## 静的ファイルを収集（本番用）
	docker-compose exec backend python manage.py collectstatic --noinput

reset-db: ## データベースをリセット
	docker-compose down
	docker volume rm quiz-app_postgres_data
	make dev
