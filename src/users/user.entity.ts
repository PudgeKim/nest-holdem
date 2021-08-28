import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'app_user' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  password: string;

  @Column()
  nickname: string;
}
