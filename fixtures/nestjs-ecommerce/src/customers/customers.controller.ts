import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { CustomersService } from "./customers.service.js";
import { CreateAddressDto } from "./dto/create-address.dto.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { type Address, CustomerEntity } from "./entities/customer.entity.js";

@Controller("customers/me")
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(
    @Inject(CustomersService)
    private readonly customersService: CustomersService,
  ) {}

  @Get()
  getProfile(): CustomerEntity {
    return this.customersService.getProfile();
  }

  @Patch()
  updateProfile(@Body() input: UpdateProfileDto): CustomerEntity {
    return this.customersService.updateProfile(input);
  }

  @Get("addresses")
  listAddresses(): readonly Address[] {
    return this.customersService.listAddresses();
  }

  @Post("addresses")
  addAddress(@Body() input: CreateAddressDto): CustomerEntity {
    return this.customersService.addAddress(input);
  }

  @Delete("addresses/:addressId")
  deleteAddress(@Param("addressId") addressId: string): CustomerEntity {
    return this.customersService.deleteAddress(addressId);
  }
}
