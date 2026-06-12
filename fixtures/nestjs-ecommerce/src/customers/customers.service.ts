import { Injectable } from "@nestjs/common";

import { CreateAddressDto } from "./dto/create-address.dto.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { type Address, CustomerEntity } from "./entities/customer.entity.js";

@Injectable()
export class CustomersService {
  private customer = new CustomerEntity({
    id: "user_1",
    email: "shopper@example.com",
    name: "Ada Shopper",
    tier: "vip",
    addresses: [
      {
        id: "addr_1",
        label: "Home",
        line1: "100 Market Street",
        city: "San Francisco",
        region: "CA",
        postalCode: "94105",
        country: "US",
        isDefault: true,
      },
    ],
  });

  getProfile(): CustomerEntity {
    return this.customer;
  }

  updateProfile(input: UpdateProfileDto): CustomerEntity {
    this.customer = new CustomerEntity({
      ...this.customer,
      name: input.name ?? this.customer.name,
    });
    return this.customer;
  }

  listAddresses(): readonly Address[] {
    return this.customer.addresses;
  }

  addAddress(input: CreateAddressDto): CustomerEntity {
    const address: Address = {
      id: `addr_${this.customer.addresses.length + 1}`,
      label: input.label,
      line1: input.line1,
      city: input.city,
      region: input.region,
      postalCode: input.postalCode,
      country: input.country,
      isDefault: input.isDefault ?? false,
    };

    this.customer = new CustomerEntity({
      ...this.customer,
      addresses: [...this.customer.addresses, address],
    });
    return this.customer;
  }

  deleteAddress(addressId: string): CustomerEntity {
    this.customer = new CustomerEntity({
      ...this.customer,
      addresses: this.customer.addresses.filter(
        (address) => address.id !== addressId,
      ),
    });
    return this.customer;
  }
}
