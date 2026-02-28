# Vector Store Init - Terraform Examples

This directory contains example Terraform configurations for different deployment scenarios.

## auto-invoke.tf

Examples of automatically invoking the Lambda function as part of Terraform deployment.

### Option 1: Invoke Once After Initial Deployment

Invokes the function once when the Lambda is first created. Subsequent applies won't re-invoke.

```hcl
resource "null_resource" "invoke_vector_store_init_once" {
  depends_on = [module.vector_store_init]

  provisioner "local-exec" {
    command = "aws lambda invoke ..."
  }

  triggers = {
    lambda_arn = module.vector_store_init.function_arn
  }
}
```

**Use when**: You want automatic setup but don't need to recreate the index on every deployment.

### Option 2: Invoke on Every Apply

Invokes the function every time you run `terraform apply`.

```hcl
triggers = {
  always_run = timestamp()
}
```

**Use when**: Development/testing environments where you want to ensure the index is always fresh.

### Option 3: Invoke with Error Handling

Includes comprehensive error handling and output parsing.

**Use when**: Production environments where you need to catch and handle failures.

### Option 4: Conditional Invocation

Uses a variable to control whether invocation happens.

```hcl
variable "auto_invoke_vector_store_init" {
  type    = bool
  default = true
}
```

**Use when**: You want to control invocation via Terraform variables or environment-specific configs.

### Option 5: Invoke with Retry Logic

Includes retry logic with exponential backoff.

**Use when**: Network issues or temporary failures are possible.

## Usage

Copy the desired example into your main Terraform configuration:

```bash
# Copy to your terraform directory
cp terraform/modules/vector-store-init/examples/auto-invoke.tf terraform/

# Or include specific sections in your main.tf
```

Then apply:

```bash
terraform apply
```

## Manual Invocation

If you prefer manual invocation:

```bash
# Get function name
FUNCTION_NAME=$(terraform output -raw vector_store_init_function_name)

# Invoke
aws lambda invoke \
  --function-name $FUNCTION_NAME \
  --payload '{}' \
  response.json

# Check result
cat response.json
```

## Recommendations

- **Development**: Use Option 2 (always invoke) or Option 4 (conditional with default=true)
- **Staging**: Use Option 3 (error handling) or Option 5 (retry logic)
- **Production**: Use Option 1 (invoke once) or manual invocation with proper testing

## Notes

- The function is idempotent - safe to invoke multiple times
- If the index already exists, it returns success without recreating
- All options require AWS CLI to be installed and configured
- The `null_resource` requires the Terraform AWS provider to be configured
