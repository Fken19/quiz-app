#!/bin/bash

# Docker環境での開発用スクリプト

echo "🐳 Docker環境をセットアップしています..."

# 既存のコンテナを停止・削除
echo "📦 既存のコンテナを停止・削除中..."
docker-compose down

# イメージを再ビルド
echo "🔨 Docker イメージを再ビルド中..."
docker-compose build --no-cache

# データベースボリュームを作成（初回のみ）
echo "🗄️ データベースを初期化中..."
docker-compose up -d db

# データベースが起動するまで待機
echo "⏳ データベースの起動を待機中..."
sleep 10

# バックエンドのマイグレーションを実行
echo "🚀 バックエンドを起動してマイグレーションを実行中..."
docker-compose up -d backend

# マイグレーションが完了するまで待機
echo "⏳ マイグレーションの完了を待機中..."
sleep 15

# フロントエンドを起動
echo "🌐 フロントエンドを起動中..."
docker-compose up -d frontend

echo "✅ Docker環境のセットアップが完了しました！"
echo ""
echo "📋 利用可能なサービス:"
echo "   - フロントエンド: http://localhost:3000"
echo "   - バックエンド API: http://localhost:8080"
echo "   - データベース: localhost:5432"
echo ""
echo "📝 Docker コマンド:"
echo "   - ログ確認: docker-compose logs -f [service_name]"
echo "   - 停止: docker-compose down"
echo "   - 再起動: docker-compose restart [service_name]"
