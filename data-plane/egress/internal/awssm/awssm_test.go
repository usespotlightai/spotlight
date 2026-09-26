package awssm

import (
	"context"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/aws/smithy-go"

	"usespotlight.ai/data-plane/protocol"
)

type client map[string]string

func (c client) GetSecretValue(
	_ context.Context, in *secretsmanager.GetSecretValueInput, _ ...func(*secretsmanager.Options),
) (*secretsmanager.GetSecretValueOutput, error) {
	held, ok := c[aws.ToString(in.SecretId)]
	if !ok {
		return nil, &smithy.GenericAPIError{Code: "ResourceNotFoundException", Message: "no such secret"}
	}
	return &secretsmanager.GetSecretValueOutput{SecretString: aws.String(held)}, nil
}

func source(id, field string) protocol.ReadInNetwork {
	return protocol.ReadInNetwork{Kind: protocol.ReadFromAWSSecretsManager, SecretID: id, Field: field}
}

func TestReadsASecretWholeOrOneFieldOfIt(t *testing.T) {
	reader := With(client{"plain": "sntrys_1", "fielded": `{"token":"sntrys_2","other":3}`})

	for asked, want := range map[protocol.ReadInNetwork]string{
		source("plain", ""):        "sntrys_1",
		source("fielded", "token"): "sntrys_2",
	} {
		if read, err := reader.Read(context.Background(), asked); err != nil || read != want {
			t.Errorf("%+v: read %q: %v", asked, read, err)
		}
	}
}

func TestSaysWhyItCouldNotRead(t *testing.T) {
	reader := With(client{"plain": "sntrys_1", "fielded": `{"other":3}`, "empty": ""})

	for asked, said := range map[protocol.ReadInNetwork]string{
		source("missing", ""):      "ResourceNotFoundException",
		source("plain", "token"):   "not JSON",
		source("fielded", "other"): "no text at other",
		source("empty", ""):        "holds no text",
		{Kind: "vault"}:            "reads no vault",
	} {
		if _, err := reader.Read(context.Background(), asked); err == nil || !strings.Contains(err.Error(), said) {
			t.Errorf("%+v: %v", asked, err)
		}
	}
}
