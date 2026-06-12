export interface Address {
  readonly id: string;
  readonly label: string;
  readonly line1: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly country: string;
  readonly isDefault: boolean;
}

export class CustomerEntity {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly tier: "standard" | "vip";
  readonly addresses: readonly Address[];

  constructor(input: {
    id: string;
    email: string;
    name: string;
    tier: "standard" | "vip";
    addresses: readonly Address[];
  }) {
    this.id = input.id;
    this.email = input.email;
    this.name = input.name;
    this.tier = input.tier;
    this.addresses = input.addresses;
  }
}
