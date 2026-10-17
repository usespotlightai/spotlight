package awssm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/aws/smithy-go"

	"usespotlight.ai/data-plane/protocol"
)

type Client interface {
	GetSecretValue(
		ctx context.Context, in *secretsmanager.GetSecretValueInput, optFns ...func(*secretsmanager.Options),
	) (*secretsmanager.GetSecretValueOutput, error)
}

type Reader struct {
	client Client
}

func Connect(ctx context.Context) (*Reader, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("find the host's AWS identity: %w", err)
	}

	return With(secretsmanager.NewFromConfig(cfg)), nil
}

func With(client Client) *Reader {
	return &Reader{client: client}
}

func (r *Reader) Read(ctx context.Context, source protocol.ExternalSecretRef) (string, error) {
	if source.Kind != protocol.ReadFromAWSSecretsManager {
		return "", fmt.Errorf("egress reads no %s", source.Kind)
	}

	answer, err := r.client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{SecretId: aws.String(source.SecretID)})
	if err != nil {
		var failed smithy.APIError
		if errors.As(err, &failed) {
			return "", fmt.Errorf("AWS Secrets Manager answered %s", failed.ErrorCode())
		}
		return "", fmt.Errorf("AWS Secrets Manager could not be asked: %w", err)
	}

	text := aws.ToString(answer.SecretString)
	if text == "" {
		return "", errors.New("AWS Secrets Manager has no text for it")
	}
	if source.Field == "" {
		return text, nil
	}

	var fields map[string]any
	if err := json.Unmarshal([]byte(text), &fields); err != nil {
		return "", fmt.Errorf("its value in AWS Secrets Manager is not JSON, so it has no %s field", source.Field)
	}

	read, ok := fields[source.Field].(string)
	if !ok || read == "" {
		return "", fmt.Errorf("its value in AWS Secrets Manager has no text at %s", source.Field)
	}

	return read, nil
}
