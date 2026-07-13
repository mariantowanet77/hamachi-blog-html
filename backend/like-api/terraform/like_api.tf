# =====================================================================
# 記事いいねAPI（Lambda(Java21) + DynamoDB + Function URL）
# Terraform 管理のインフラリポジトリにコピーして使うスニペット。
#
# 使い方:
#   1. ブログリポジトリ側で `mvn package` して target/like-api.jar を作る
#   2. 下の local.like_api_jar のパスを自分の環境に合わせる
#   3. terraform apply → 出力された function URL を common/site.js の
#      LIKE_API_URL に貼る
# =====================================================================

locals {
  # ビルド済み JAR への相対パス（インフラリポジトリから見た位置に合わせて変更）
  like_api_jar = "../hamachi-blog-html/backend/like-api/target/like-api.jar"
}

# ---------------------------------------------------------------------
# DynamoDB: 1記事 = 1アイテムのシンプルなカウンターテーブル
#   article_id (S) … 記事フォルダ名（例: "20260708"）
#   like_count (N) … いいね数（Lambda が UpdateItem で加算・減算）
# ---------------------------------------------------------------------
resource "aws_dynamodb_table" "blog_likes" {
  name         = "hamachi-blog-likes"
  billing_mode = "PAY_PER_REQUEST" # アクセスが少ないブログなのでオンデマンドで十分
  hash_key     = "article_id"

  attribute {
    name = "article_id"
    type = "S"
  }
}

# ---------------------------------------------------------------------
# IAM: Lambda 実行ロール（CloudWatch Logs + いいねテーブルの読み書きのみ）
# ---------------------------------------------------------------------
resource "aws_iam_role" "like_api" {
  name = "hamachi-blog-like-api"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "like_api_logs" {
  role       = aws_iam_role.like_api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "like_api_dynamodb" {
  name = "like-api-dynamodb"
  role = aws_iam_role.like_api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
      ]
      Resource = aws_dynamodb_table.blog_likes.arn
    }]
  })
}

# ---------------------------------------------------------------------
# Lambda 関数（Java 21 / arm64）
# Java はコールドスタートが重めなのでメモリ 512MB（CPU も比例して増える）
# ---------------------------------------------------------------------
resource "aws_lambda_function" "like_api" {
  function_name = "hamachi-blog-like-api"
  role          = aws_iam_role.like_api.arn

  runtime       = "java21"
  handler       = "com.hamachidaily.likes.LikeHandler::handleRequest"
  architectures = ["arm64"] # Graviton: x86 より安い

  filename         = local.like_api_jar
  source_code_hash = filebase64sha256(local.like_api_jar)

  memory_size = 512
  timeout     = 10

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.blog_likes.name
    }
  }
}

# ---------------------------------------------------------------------
# Function URL（API Gateway なしで HTTPS エンドポイントを公開）
# CORS はここで設定するので、Java 側でヘッダーを付ける必要はない
# ---------------------------------------------------------------------
resource "aws_lambda_function_url" "like_api" {
  function_name      = aws_lambda_function.like_api.function_name
  authorization_type = "NONE" # 公開API（記事IDの形式チェックは Lambda 側で実施）

  cors {
    allow_origins = ["https://hamachi-daily.com"]
    allow_methods = ["GET", "POST"]
    allow_headers = ["content-type"] # POST の JSON 送信（プリフライト）用
    max_age       = 86400
  }
}

output "like_api_url" {
  description = "common/site.js の LIKE_API_URL に設定する値"
  value       = aws_lambda_function_url.like_api.function_url
}
